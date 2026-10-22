import os
import sys
import time
import json
import random
import pandas as pd
import pyarrow.dataset as ds
from sqlalchemy import text, create_engine

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.db import get_db_connection, normalize_store_code, normalize_item_code, fetch_promo_sales_and_stock
from app.parquet_store import read_sales, coverage

PARQUET_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "parquet_cache"))
SINGLE_SALES_FILE = os.path.join(PARQUET_BASE, "sales.parquet")
MANIFEST_FILE = os.path.join(PARQUET_BASE, "_manifest.json")

def run_validation():
    print("=== TASK 4 VALIDATION SUITE (SINGLE PARQUET FILE) ===\n")
    engine = create_engine("mssql+pyodbc://", creator=get_db_connection)

    print("a) Checking for duplicate (sale_date, store_code, item_code) rows...")
    dataset = ds.dataset(SINGLE_SALES_FILE, format="parquet")
    df_all = dataset.to_table(columns=['sale_date', 'store_code', 'item_code']).to_pandas()
    dup_count = df_all.duplicated(subset=['sale_date', 'store_code', 'item_code']).sum()
    print(f"   Duplicate rows count in sales.parquet: {dup_count}")

    if dup_count > 0:
        print("   [FAIL] Duplicates detected!")
    else:
        print("   [PASS] 0 duplicates found.")

    print("\nb) Reconciling 3 Random Days (Parquet vs Live SQL)...")
    all_dates = sorted(df_all['sale_date'].unique().tolist())
    random.seed(42)
    sample_days = sorted(random.sample(all_dates, 3))

    sql_template = text("""
        SELECT 
            CAST(TARIX AS DATE) as sale_date,
            CAST(MAGAZA AS VARCHAR(50)) as store_code,
            CAST(MEHSUL_KODU AS VARCHAR(50)) as item_code,
            SUM(CAST(MIQDARI AS FLOAT)) as sales_qty,
            SUM(CAST(SATIS_EDV AS FLOAT)) as sales_amount
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING(:day, :day)
        WHERE TARIX IS NOT NULL AND MAGAZA IS NOT NULL AND MEHSUL_KODU IS NOT NULL
        GROUP BY CAST(TARIX AS DATE), CAST(MAGAZA AS VARCHAR(50)), CAST(MEHSUL_KODU AS VARCHAR(50))
    """)

    recon_results = []
    for d_str in sample_days:
        df_pq_day = read_sales(d_str, d_str)
        pq_rows = len(df_pq_day)
        pq_qty = float(df_pq_day['sales_qty'].sum())
        pq_amt = float(df_pq_day['sales_amount'].sum())

        with engine.connect() as conn:
            df_sql_day = pd.read_sql_query(sql_template, conn, params={"day": d_str})

        if not df_sql_day.empty:
            df_sql_day['store_code'] = df_sql_day['store_code'].apply(lambda s: normalize_store_code(s) or str(s))
            df_sql_day['item_code'] = df_sql_day['item_code'].apply(lambda c: normalize_item_code(c) or str(c))
            sql_agg = df_sql_day.groupby(['store_code', 'item_code'], as_index=False).agg({
                'sales_qty': 'sum',
                'sales_amount': 'sum'
            })
            sql_rows = len(sql_agg)
            sql_qty = float(sql_agg['sales_qty'].sum())
            sql_amt = float(sql_agg['sales_amount'].sum())
        else:
            sql_rows, sql_qty, sql_amt = 0, 0.0, 0.0

        qty_diff = abs(pq_qty - sql_qty)
        amt_diff = abs(pq_amt - sql_amt)
        matches = (pq_rows == sql_rows) and (qty_diff <= 0.01) and (amt_diff <= 0.01)

        print(f"   Date {d_str}:")
        print(f"     Parquet -> Rows: {pq_rows:,}, Qty: {pq_qty:,.2f}, Amount: {pq_amt:,.2f}")
        print(f"     SQL     -> Rows: {sql_rows:,}, Qty: {sql_qty:,.2f}, Amount: {sql_amt:,.2f}")
        print(f"     Status: {'[MATCH]' if matches else '[DIFF FAIL]'}")
        recon_results.append(matches)

    print("\nc) Reconciling with App logic for a 7-day window...")
    test_beg = "2026-10-01"
    test_end = "2026-10-07"
    
    sample_stores = ["101", "102", "103", "104", "105"]
    sample_items = df_all['item_code'].unique()[:50].tolist()

    df_pq_win = read_sales(test_beg, test_end, store_codes=sample_stores, item_codes=sample_items)
    pq_win_qty = float(df_pq_win['sales_qty'].sum()) if not df_pq_win.empty else 0.0
    pq_win_pairs = len(df_pq_win[['store_code', 'item_code']].drop_duplicates()) if not df_pq_win.empty else 0

    sql_win_template = text("""
        SELECT 
            CAST(MAGAZA AS VARCHAR(50)) as store_code,
            CAST(MEHSUL_KODU AS VARCHAR(50)) as item_code,
            SUM(CAST(MIQDARI AS FLOAT)) as sales_qty
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING(:beg, :end)
        WHERE TARIX IS NOT NULL AND MAGAZA IS NOT NULL AND MEHSUL_KODU IS NOT NULL
        GROUP BY CAST(MAGAZA AS VARCHAR(50)), CAST(MEHSUL_KODU AS VARCHAR(50))
    """)
    with engine.connect() as conn:
        df_win_sql = pd.read_sql_query(sql_win_template, conn, params={"beg": test_beg, "end": test_end})

    if not df_win_sql.empty:
        df_win_sql['store_code'] = df_win_sql['store_code'].apply(lambda s: normalize_store_code(s) or str(s))
        df_win_sql['item_code'] = df_win_sql['item_code'].apply(lambda c: normalize_item_code(c) or str(c))
        df_win_sql = df_win_sql[df_win_sql['store_code'].isin(sample_stores) & df_win_sql['item_code'].isin(sample_items)]
        sql_win_qty = float(df_win_sql['sales_qty'].sum())
        sql_win_pairs = len(df_win_sql[['store_code', 'item_code']].drop_duplicates())
    else:
        sql_win_qty, sql_win_pairs = 0.0, 0

    print(f"   Window {test_beg}..{test_end} (Sample 5 stores x 50 items):")
    print(f"     Parquet File -> Pairs: {pq_win_pairs}, Sales Qty: {pq_win_qty:,.2f}")
    print(f"     Live SQL     -> Pairs: {sql_win_pairs}, Sales Qty: {sql_win_qty:,.2f}")
    app_match = (sql_win_pairs == pq_win_pairs) and (abs(sql_win_qty - pq_win_qty) <= 0.01)
    print(f"     Status: {'[MATCH]' if app_match else '[DIFF FAIL]'}")

    print("\nd) Calculating Size & Performance Metrics...")
    cov = coverage()
    total_rows = cov["total_rows"]

    sales_file_bytes = os.path.getsize(SINGLE_SALES_FILE) if os.path.exists(SINGLE_SALES_FILE) else 0
    items_file_bytes = os.path.getsize(os.path.join(PARQUET_BASE, "items.parquet")) if os.path.exists(os.path.join(PARQUET_BASE, "items.parquet")) else 0
    total_disk_bytes = sales_file_bytes + items_file_bytes

    est_csv_bytes = total_rows * 42

    all_stores = sorted(df_all['store_code'].unique().tolist())[:97]
    all_items = sorted(df_all['item_code'].unique().tolist())[:1000]
    bench_beg = "2026-09-25"
    bench_end = "2026-10-08"

    t0 = time.perf_counter()
    df_bench = read_sales(bench_beg, bench_end, store_codes=all_stores, item_codes=all_items)
    t_read = time.perf_counter() - t0

    print(f"   - Total Extracted Rows: {total_rows:,}")
    print(f"   - Single Sales Parquet Size: {sales_file_bytes / (1024*1024):.2f} MB ({sales_file_bytes:,} bytes)")
    print(f"   - Items Dimension Size: {items_file_bytes / (1024*1024):.2f} MB ({items_file_bytes:,} bytes)")
    print(f"   - Total Parquet Cache Size: {total_disk_bytes / (1024*1024):.2f} MB ({total_disk_bytes:,} bytes)")
    print(f"   - Equivalent Uncompressed CSV Size: ~{est_csv_bytes / (1024*1024):.2f} MB")
    print(f"   - Compression Ratio: ~{(est_csv_bytes / total_disk_bytes):.1f}x smaller than CSV")
    print(f"   - Benchmark Read Time (14 days, 97 stores x 1000 items): {len(df_bench):,} rows read in {t_read*1000:.2f} ms ({t_read:.4f}s)")
    print(f"   - Target (< 1.0s): {'[PASS]' if t_read < 1.0 else '[FAIL]'}")

if __name__ == "__main__":
    run_validation()
