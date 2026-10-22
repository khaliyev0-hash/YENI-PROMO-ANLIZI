import os
import sys
import pandas as pd
import json

# Add backend root to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import get_db_connection, fetch_promo_sales_and_stock, normalize_store_code, normalize_item_code

def main():
    print("=======================================================")
    print("TASK 0 - INVESTIGATING DAILY STOCK SOURCE")
    print("=======================================================")

    # 1. Inspect current implementation of StoreDailyStockPage data feed
    print("\n--- 1. How day-by-day stock series is fed today ---")
    print("Page: StoreDailyStockPage.tsx calls GET /api/item-detail?store=...&code=...")
    print("Endpoint: /api/item-detail calls get_item_stock_movement(timeline_df, store, code)")
    print("Timeline source: normalizer.py creates timeline_df from db_df returned by fetch_promo_sales_and_stock()")
    print("DB fetch source: db.py merges stock_df (from vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING) with aggregated_sales (from fnc_TS_SALES_REPORT_FOR_PLANNING)")

    # 2. Check current_stock in DB query result for store 101 / item 100003 and 2 other pairs
    print("\n--- 2. Checking current_stock in DB query result ---")
    db_df = fetch_promo_sales_and_stock("2026-10-01", "2026-10-07")
    db_df['norm_store'] = db_df['store_code'].astype(str).map(lambda s: normalize_store_code(s) or s)
    db_df['norm_code'] = db_df['item_code'].astype(str).map(lambda c: normalize_item_code(c) or c)

    pairs_to_check = [
        ('101', '100003'),
        ('101', '100026'),
        ('101', '100097')
    ]

    for st, cd in pairs_to_check:
        st_norm = normalize_store_code(st) or st
        cd_norm = normalize_item_code(cd) or cd
        sub = db_df[(db_df['norm_store'] == st_norm) & (db_df['norm_code'] == cd_norm)].sort_values('sale_date')
        print(f"\nPair (store: {st}, item: {cd}): {len(sub)} rows found")
        if not sub.empty:
            for idx, r in sub.iterrows():
                print(f"  sale_date: {r['sale_date']} | sales_qty: {r['sales_qty']} | current_stock: {r['current_stock']}")
        else:
            print("  No rows found in date range 2026-10-01..2026-10-07")

    # 3. Search SQL Server DB for objects holding historical daily stock per (store, item)
    print("\n--- 3. Searching SQL Server database for historical daily stock objects ---")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        print("Connected to SQL Server successfully!")

        search_terms = ['STOCK', 'STOK', 'BALANCE', 'SNAPSHOT', 'HISTORY', 'MOVEMENT', 'TURNOVER', 'QALIQ', 'DEPO', 'LOG']
        
        # Search TABLES and VIEWS
        tables_query = """
        SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
        FROM INFORMATION_SCHEMA.TABLES
        ORDER BY TABLE_TYPE, TABLE_NAME
        """
        cursor.execute(tables_query)
        all_tables = cursor.fetchall()
        
        matching_objects = []
        for schema, name, ttype in all_tables:
            name_upper = name.upper()
            if any(term in name_upper for term in search_terms):
                matching_objects.append((schema, name, ttype))

        print(f"\nFound {len(matching_objects)} candidate database objects matching search terms:")
        for schema, name, ttype in matching_objects:
            print(f"  - [{schema}].[{name}] ({ttype})")

        # Also search columns across all tables/views for daily stock date columns
        cols_query = """
        SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE COLUMN_NAME LIKE '%STOK%' 
           OR COLUMN_NAME LIKE '%STOCK%' 
           OR COLUMN_NAME LIKE '%QALIQ%' 
           OR COLUMN_NAME LIKE '%BALANCE%'
        ORDER BY TABLE_NAME, COLUMN_NAME
        """
        cursor.execute(cols_query)
        all_cols = cursor.fetchall()

        print(f"\nFound {len(all_cols)} candidate columns across database objects:")
        table_cols_map = {}
        for schema, tbl, col, dtype in all_cols:
            full_tbl = f"{schema}.{tbl}"
            if full_tbl not in table_cols_map:
                table_cols_map[full_tbl] = []
            table_cols_map[full_tbl].append((col, dtype))

        for tbl, cols in table_cols_map.items():
            print(f"  Table/View {tbl}: {[c[0] for c in cols]}")

        # Check sample rows from candidate views/tables for store 101 / item 100003 for dates 2026-10-05..2026-10-08
        print("\n--- Testing Candidate Views for Historical Daily Stock per (store, item) ---")
        for schema, name, ttype in matching_objects:
            full_name = f"[{schema}].[{name}]"
            try:
                # Get column list for object
                cursor.execute(f"SELECT TOP 1 * FROM {full_name}")
                col_names = [column[0] for column in cursor.description]
                print(f"\nObject {full_name} columns: {col_names}")

                # Check if there is a date column and store/item column
                has_date = any(k in col.upper() for col in col_names for k in ['TARIX', 'DATE', 'DAY', 'TIME'])
                has_store = any(k in col.upper() for col in col_names for k in ['MAGAZA', 'STORE', 'IS YERI', 'IS_YERI'])
                has_item = any(k in col.upper() for col in col_names for k in ['URUN', 'MEHSUL', 'ITEM', 'SKU', 'KOD'])

                print(f"  -> Features: has_date={has_date}, has_store={has_store}, has_item={has_item}")

                if has_date and has_store and has_item:
                    # Query sample for store 101, item 100003
                    sample_sql = f"SELECT TOP 10 * FROM {full_name}"
                    cursor.execute(sample_sql)
                    sample_rows = cursor.fetchall()
                    print(f"  -> Sample rows count: {len(sample_rows)}")
                    for r in sample_rows[:3]:
                        print(f"     {r}")
            except Exception as e:
                print(f"  -> Error querying {full_name}: {e}")

        conn.close()

    except Exception as e:
        print(f"Database connection error: {e}")

if __name__ == "__main__":
    main()
