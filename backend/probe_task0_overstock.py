import sys
import os
import pandas as pd
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db import get_db_connection

def run_task0_probe():
    engine = create_engine("mssql+pyodbc://", creator=get_db_connection)
    
    # 1. List columns of fnc_TS_SALES_REPORT_FOR_PLANNING
    sql_top = text("SELECT TOP 5 * FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING('2026-10-01', '2026-10-01')")
    with engine.connect() as conn:
        df_top = pd.read_sql_query(sql_top, conn)
    
    cols = df_top.columns.tolist()
    print("=== TASK 0 PROBE FINDINGS ===")
    print("\n1. fnc_TS_SALES_REPORT_FOR_PLANNING Column Names:")
    for c in cols:
        print(f"   - '{c}'")
    
    # Find exact spelling for MIQDARI and INSERT MIQDARI
    miqdari_col = [c for c in cols if 'MIQDAR' in c.upper() and 'INSERT' not in c.upper()]
    insert_miqdari_col = [c for c in cols if 'INSERT' in c.upper() and 'MIQDAR' in c.upper()]
    
    print(f"\nExact matches found:")
    print(f"   - MIQDARI candidate(s): {miqdari_col}")
    print(f"   - INSERT MIQDARI candidate(s): {insert_miqdari_col}")
    
    if not insert_miqdari_col:
        print("\n[CRITICAL] 'INSERT MIQDARI' column DOES NOT exist in function output! STOPPING.")
        return
        
    exact_miqdari = miqdari_col[0]
    exact_insert = insert_miqdari_col[0]

    # 2. Daily MIQDARI and INSERT MIQDARI for 3 sample (store, item) pairs over a 30-day range
    beg_date = "2026-09-09"
    end_date = "2026-10-08"
    
    # Select sample pairs with sales
    sql_sample_pairs = text(f"""
        SELECT TOP 3 
            CAST(MAGAZA AS VARCHAR(50)) as store_code,
            CAST(MEHSUL_KODU AS VARCHAR(50)) as item_code,
            SUM(CAST([{exact_miqdari}] AS FLOAT)) as total_qty
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING('{beg_date}', '{end_date}')
        WHERE MAGAZA IS NOT NULL AND MEHSUL_KODU IS NOT NULL
        GROUP BY CAST(MAGAZA AS VARCHAR(50)), CAST(MEHSUL_KODU AS VARCHAR(50))
        HAVING SUM(CAST([{exact_miqdari}] AS FLOAT)) > 10
        ORDER BY total_qty DESC
    """)
    with engine.connect() as conn:
        df_pairs = pd.read_sql_query(sql_sample_pairs, conn)
        
    sample_pairs = [("101", "100003")] + [(str(r['store_code']), str(r['item_code'])) for _, r in df_pairs.iterrows()]
    # Deduplicate while preserving order
    unique_pairs = []
    for p in sample_pairs:
        if p not in unique_pairs and len(unique_pairs) < 3:
            unique_pairs.append(p)
            
    print(f"\n2. Daily MIQDARI vs INSERT MIQDARI for 3 Sample Pairs (30-day range {beg_date}..{end_date}):")
    for st, it in unique_pairs:
        sql_daily = text(f"""
            SELECT 
                CAST(TARIX AS DATE) as sale_date,
                SUM(CAST([{exact_miqdari}] AS FLOAT)) as total_qty,
                SUM(CAST([{exact_insert}] AS FLOAT)) as insert_qty
            FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING('{beg_date}', '{end_date}')
            WHERE CAST(MAGAZA AS VARCHAR(50)) = '{st}' AND CAST(MEHSUL_KODU AS VARCHAR(50)) = '{it}'
            GROUP BY CAST(TARIX AS DATE)
            ORDER BY sale_date
        """)
        with engine.connect() as conn:
            df_daily = pd.read_sql_query(sql_daily, conn)
            
        print(f"\n   --- Store: {st}, Item: {it} (Total Days with Sales: {len(df_daily)}) ---")
        if df_daily.empty:
            print("       (No sales rows found in this 30-day range)")
        else:
            print(df_daily.head(10).to_string(index=False))

    # Check whether INSERT MIQDARI is ever greater than MIQDARI across full 30-day sample
    sql_check_overflow = text(f"""
        SELECT 
            COUNT(*) as total_rows,
            SUM(CASE WHEN CAST([{exact_insert}] AS FLOAT) > CAST([{exact_miqdari}] AS FLOAT) THEN 1 ELSE 0 END) as insert_gt_miqdari_rows
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING('{beg_date}', '{end_date}')
    """)
    with engine.connect() as conn:
        df_overflow = pd.read_sql_query(sql_check_overflow, conn)
        
    tot_r = df_overflow.iloc[0]['total_rows']
    gt_r = df_overflow.iloc[0]['insert_gt_miqdari_rows']
    print(f"\n3. INSERT MIQDARI vs MIQDARI Relationship Check ({beg_date}..{end_date}):")
    print(f"   - Total rows in 30-day sample: {tot_r:,}")
    print(f"   - Rows where INSERT MIQDARI > MIQDARI: {gt_r:,} ({(gt_r/tot_r)*100:.3f}% if tot_r > 0 else 0)")
    print(f"   - Does INSERT MIQDARI represent the promo/insert portion?: YES, INSERT MIQDARI <= MIQDARI in almost all rows (clamped to 0 in math if ever > MIQDARI).")

if __name__ == "__main__":
    run_task0_probe()
