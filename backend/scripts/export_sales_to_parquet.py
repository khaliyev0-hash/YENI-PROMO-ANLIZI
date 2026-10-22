import os
import sys
import json
import time
import argparse
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.dataset as ds
from sqlalchemy import create_engine, text

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db import get_db_connection, normalize_store_code, normalize_item_code

PARQUET_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "parquet_cache"))
SINGLE_SALES_FILE = os.path.join(PARQUET_BASE, "sales.parquet")
ITEMS_FILE = os.path.join(PARQUET_BASE, "items.parquet")
MANIFEST_FILE = os.path.join(PARQUET_BASE, "_manifest.json")

def get_sqlalchemy_engine():
    return create_engine("mssql+pyodbc://", creator=get_db_connection, pool_pre_ping=True)

def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()

def fetch_chunk_sales(engine, beg_str: str, end_str: str, retries: int = 3) -> pd.DataFrame:
    sql = text("""
        SELECT 
            CAST(TARIX AS DATE) as sale_date,
            CAST(MAGAZA AS VARCHAR(50)) as store_code,
            CAST(MEHSUL_KODU AS VARCHAR(50)) as item_code,
            SUM(CAST(MIQDARI AS FLOAT)) as sales_qty,
            SUM(CAST(SATIS_EDV AS FLOAT)) as sales_amount
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING(:beg, :end)
        WHERE TARIX IS NOT NULL AND MAGAZA IS NOT NULL AND MEHSUL_KODU IS NOT NULL
        GROUP BY CAST(TARIX AS DATE), CAST(MAGAZA AS VARCHAR(50)), CAST(MEHSUL_KODU AS VARCHAR(50))
    """)
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                df = pd.read_sql_query(sql, conn, params={"beg": beg_str, "end": end_str})
                return df
        except Exception as e:
            if attempt == retries:
                raise RuntimeError(f"Failed to fetch sales for range {beg_str}..{end_str} after {retries} attempts: {e}")
            time.sleep(attempt * 2)

def fetch_chunk_items(engine, beg_str: str, end_str: str, retries: int = 3) -> pd.DataFrame:
    sql = text("""
        SELECT DISTINCT
            CAST(MEHSUL_KODU AS VARCHAR(50)) as item_code,
            CAST(MEHSUL_ADI AS VARCHAR(255)) as item_name,
            CAST([FAMILY NAME] AS VARCHAR(255)) as family_name,
            CAST([CATEGORY NAME] AS VARCHAR(255)) as category_name,
            CAST([SUB CATEGORY NAME] AS VARCHAR(255)) as sub_category_name,
            CAST(MUSTERI_ADI AS VARCHAR(255)) as supplier_name,
            CAST(SPECODE2 AS VARCHAR(255)) as barcode
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING(:beg, :end)
        WHERE MEHSUL_KODU IS NOT NULL
    """)
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                df = pd.read_sql_query(sql, conn, params={"beg": beg_str, "end": end_str})
                return df
        except Exception as e:
            if attempt == retries:
                print(f"Warning: Failed to fetch items metadata for range {beg_str}..{end_str}: {e}")
                return pd.DataFrame()
            time.sleep(attempt * 2)

def load_existing_sales_df() -> pd.DataFrame:
    if os.path.exists(SINGLE_SALES_FILE):
        try:
            table = pq.read_table(SINGLE_SALES_FILE)
            df = table.to_pandas()
            df['sale_date'] = df['sale_date'].astype(str)
            df['store_code'] = df['store_code'].astype(str)
            df['item_code'] = df['item_code'].astype(str)
            df['sales_qty'] = df['sales_qty'].astype('float64')
            df['sales_amount'] = df['sales_amount'].astype('float64')
            return df
        except Exception as e:
            print(f"Warning: Could not read existing {SINGLE_SALES_FILE}: {e}")
    return pd.DataFrame(columns=['sale_date', 'store_code', 'item_code', 'sales_qty', 'sales_amount'])

def save_single_sales_parquet(sales_df: pd.DataFrame):
    os.makedirs(PARQUET_BASE, exist_ok=True)
    tmp_file = SINGLE_SALES_FILE + ".tmp"

    clean_df = sales_df[['sale_date', 'store_code', 'item_code', 'sales_qty', 'sales_amount']].copy()
    clean_df['sale_date'] = clean_df['sale_date'].astype(str)
    clean_df['store_code'] = clean_df['store_code'].astype(str)
    clean_df['item_code'] = clean_df['item_code'].astype(str)
    clean_df['sales_qty'] = clean_df['sales_qty'].astype('float64')
    clean_df['sales_amount'] = clean_df['sales_amount'].astype('float64')

    clean_df.sort_values(by=['sale_date', 'store_code', 'item_code'], inplace=True)

    schema = pa.schema([
        ('sale_date', pa.string()),
        ('store_code', pa.string()),
        ('item_code', pa.string()),
        ('sales_qty', pa.float64()),
        ('sales_amount', pa.float64())
    ])
    table = pa.Table.from_pandas(clean_df, schema=schema, preserve_index=False)
    pq.write_table(table, tmp_file, compression='zstd')
    os.replace(tmp_file, SINGLE_SALES_FILE)

def load_existing_manifest() -> Dict[str, Any]:
    if os.path.exists(MANIFEST_FILE):
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "schema_version": "1.0",
        "script_version": "1.0.0",
        "source_objects": ["dbo.fnc_TS_SALES_REPORT_FOR_PLANNING"],
        "date_from": None,
        "date_to": None,
        "per_day": {}
    }

def save_manifest(manifest: Dict[str, Any]):
    os.makedirs(PARQUET_BASE, exist_ok=True)
    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

def update_items_parquet(items_dict: Dict[str, Dict[str, Any]]):
    if not items_dict:
        return
    items_df = pd.DataFrame(list(items_dict.values()))
    items_df.sort_values(by=['item_code'], inplace=True)
    schema = pa.schema([
        ('item_code', pa.string()),
        ('item_name', pa.string()),
        ('family_name', pa.string()),
        ('category_name', pa.string()),
        ('sub_category_name', pa.string()),
        ('supplier_name', pa.string()),
        ('barcode', pa.string())
    ])
    table = pa.Table.from_pandas(items_df, schema=schema, preserve_index=False)
    tmp_items = ITEMS_FILE + ".tmp"
    pq.write_table(table, tmp_items, compression='zstd')
    os.replace(tmp_items, ITEMS_FILE)

def main():
    parser = argparse.ArgumentParser(description="Export SQL Server sales history to single local Parquet file.")
    parser.add_argument("--months", type=int, default=3, help="Default months range ending yesterday.")
    parser.add_argument("--from", dest="from_date", type=str, help="Start date YYYY-MM-DD.")
    parser.add_argument("--to", dest="to_date", type=str, help="End date YYYY-MM-DD.")
    parser.add_argument("--update", action="store_true", help="Incremental reload from (last date - 3 days) to yesterday.")
    parser.add_argument("--chunk-days", type=int, default=1, help="Chunk size in days (default 1).")
    parser.add_argument("--sleep", type=float, default=0.5, help="Sleep duration in seconds between chunks.")
    parser.add_argument("--overwrite", action="store_true", help="Force re-extraction of existing partitions.")

    args = parser.parse_args()

    yesterday = date.today() - timedelta(days=1)

    existing_df = load_existing_sales_df() if not args.overwrite else pd.DataFrame(columns=['sale_date', 'store_code', 'item_code', 'sales_qty', 'sales_amount'])
    existing_dates = set(existing_df['sale_date'].unique()) if not existing_df.empty else set()

    if args.from_date and args.to_date:
        d_start = parse_date(args.from_date)
        d_end = parse_date(args.to_date)
    elif args.update:
        if existing_dates:
            sorted_dates = sorted(list(existing_dates))
            last_date = parse_date(sorted_dates[-1])
            d_start = max(parse_date(sorted_dates[0]), last_date - timedelta(days=3))
        else:
            d_start = yesterday - timedelta(days=args.months * 30)
        d_end = yesterday
    else:
        d_end = yesterday
        d_start = yesterday - timedelta(days=args.months * 30)

    if d_end > yesterday:
        d_end = yesterday

    print(f"=== Export Sales to Single Parquet File ===")
    print(f"Target Date Range: {d_start} to {d_end}")
    print(f"Output File: {SINGLE_SALES_FILE}")
    print(f"Chunk Size: {args.chunk_days} day(s) | Sleep: {args.sleep}s | Overwrite: {args.overwrite}")

    engine = get_sqlalchemy_engine()
    manifest = load_existing_manifest()
    items_map: Dict[str, Dict[str, Any]] = {}

    if os.path.exists(ITEMS_FILE):
        try:
            existing_items_df = pq.read_table(ITEMS_FILE).to_pandas()
            for _, r in existing_items_df.iterrows():
                items_map[str(r['item_code'])] = r.to_dict()
        except Exception as e:
            print(f"Notice: Could not load existing items.parquet: {e}")

    curr_date = d_start
    date_chunks: List[List[date]] = []
    while curr_date <= d_end:
        chunk = []
        for _ in range(args.chunk_days):
            if curr_date <= d_end:
                chunk.append(curr_date)
                curr_date += timedelta(days=1)
        date_chunks.append(chunk)

    total_chunks = len(date_chunks)
    t_start_total = time.perf_counter()
    new_data_frames: List[pd.DataFrame] = []

    for idx, chunk in enumerate(date_chunks, start=1):
        c_beg = chunk[0]
        c_end = chunk[-1]
        c_beg_str = c_beg.strftime("%Y-%m-%d")
        c_end_str = c_end.strftime("%Y-%m-%d")

        chunk_date_strs = set(d.strftime("%Y-%m-%d") for d in chunk)

        if not args.overwrite and not args.update:
            if chunk_date_strs.issubset(existing_dates):
                print(f"[{idx}/{total_chunks}] Skipping chunk {c_beg_str}..{c_end_str} (already in sales.parquet)")
                continue

        t0 = time.perf_counter()
        df_sales = fetch_chunk_sales(engine, c_beg_str, c_end_str)

        if not df_sales.empty:
            df_sales['sale_date'] = pd.to_datetime(df_sales['sale_date']).dt.strftime('%Y-%m-%d')
            df_sales['store_code'] = df_sales['store_code'].apply(lambda s: normalize_store_code(s) or str(s))
            df_sales['item_code'] = df_sales['item_code'].apply(lambda c: normalize_item_code(c) or str(c))

            grouped = df_sales.groupby(['sale_date', 'store_code', 'item_code'], as_index=False).agg({
                'sales_qty': 'sum',
                'sales_amount': 'sum'
            })
            new_data_frames.append(grouped)
        else:
            grouped = pd.DataFrame(columns=['sale_date', 'store_code', 'item_code', 'sales_qty', 'sales_amount'])

        for d in chunk:
            d_str = d.strftime("%Y-%m-%d")
            day_data = grouped[grouped['sale_date'] == d_str]
            rows_cnt = len(day_data)
            sum_q = float(day_data['sales_qty'].sum()) if rows_cnt > 0 else 0.0
            sum_a = float(day_data['sales_amount'].sum()) if rows_cnt > 0 else 0.0

            manifest["per_day"][d_str] = {
                "rows": rows_cnt,
                "sum_qty": round(sum_q, 4),
                "sum_amount": round(sum_a, 4),
                "extracted_at": datetime.now().isoformat()
            }

        df_items = fetch_chunk_items(engine, c_beg_str, c_end_str)
        if not df_items.empty:
            for _, r in df_items.iterrows():
                icode = normalize_item_code(r['item_code']) or str(r['item_code']).strip()
                if icode:
                    items_map[icode] = {
                        'item_code': icode,
                        'item_name': str(r['item_name']).strip() if pd.notnull(r['item_name']) else "",
                        'family_name': str(r['family_name']).strip() if pd.notnull(r['family_name']) else "",
                        'category_name': str(r['category_name']).strip() if pd.notnull(r['category_name']) else "",
                        'sub_category_name': str(r['sub_category_name']).strip() if pd.notnull(r['sub_category_name']) else "",
                        'supplier_name': str(r['supplier_name']).strip() if pd.notnull(r['supplier_name']) else "",
                        'barcode': str(r['barcode']).strip() if pd.notnull(r['barcode']) else ""
                    }

        elapsed = time.perf_counter() - t0
        print(f"[{idx}/{total_chunks}] Chunk {c_beg_str}..{c_end_str}: {len(grouped):,} rows extracted in {elapsed:.2f}s")

        if args.sleep > 0:
            time.sleep(args.sleep)

    # Combine existing + new data frames, remove updated dates, deduplicate & save single parquet file
    if new_data_frames:
        all_new_df = pd.concat(new_data_frames, ignore_index=True)
        extracted_dates = set(all_new_df['sale_date'].unique())

        # Keep existing rows for dates NOT in extracted_dates
        if not existing_df.empty:
            retained_existing = existing_df[~existing_df['sale_date'].isin(extracted_dates)]
            combined_df = pd.concat([retained_existing, all_new_df], ignore_index=True)
        else:
            combined_df = all_new_df

        combined_df.drop_duplicates(subset=['sale_date', 'store_code', 'item_code'], keep='last', inplace=True)
        save_single_sales_parquet(combined_df)

    all_extracted_dates = sorted(manifest["per_day"].keys())
    if all_extracted_dates:
        manifest["date_from"] = all_extracted_dates[0]
        manifest["date_to"] = all_extracted_dates[-1]

    save_manifest(manifest)
    update_items_parquet(items_map)

    t_total = time.perf_counter() - t_start_total
    print(f"\nExtraction & consolidation complete in {t_total:.2f}s.")
    print(f"Single file {SINGLE_SALES_FILE} written successfully ({os.path.getsize(SINGLE_SALES_FILE)/(1024*1024):.2f} MB).")

if __name__ == "__main__":
    main()
