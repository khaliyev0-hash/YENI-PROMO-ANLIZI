import os
import sys
import time
import warnings
from datetime import datetime
import pandas as pd

# Add backend root directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import get_db_connection

CACHE_DIR = os.path.join(backend_dir, "data", "parquet_cache")
STOCK_PARQUET = os.path.join(CACHE_DIR, "stock_snapshot.parquet")
SALES_PARQUET = os.path.join(CACHE_DIR, "sales_snapshot.parquet")
META_JSON = os.path.join(CACHE_DIR, "cache_metadata.json")

def export_all_to_parquet(start_date: str = "2026-06-01", end_date: str = "2026-12-31") -> dict:
    """
    High-Performance ETL Script:
    Queries SQL Server for stock metadata and sales historical snapshot,
    saves them to pyarrow/snappy compressed parquet cache files.
    """
    t_start = time.perf_counter()
    os.makedirs(CACHE_DIR, exist_ok=True)
    export_timestamp = datetime.now().isoformat()
    
    print(f"[{export_timestamp}] Starting Parquet Cache ETL Export...", flush=True)
    print("Connecting to SQL Server database...", flush=True)
    
    conn = get_db_connection()
    try:
        # 1. Extract Stock Snapshot & Item Master Metadata
        print("Extracting Stock Snapshot & Item Master metadata from SQL Server...", flush=True)
        t0 = time.perf_counter()
        stock_sql = """
        SELECT 
            CAST([IS YERI NO] AS VARCHAR(20)) AS store_code,
            LTRIM(RTRIM(CAST([URUN KODU] AS VARCHAR(50)))) AS item_code,
            [URUN AD] AS item_name,
            [FAMILY NAME] AS family_name,
            [CATEGORY NAME] AS category_name,
            [SUB CATEGORY NAME] AS sub_category_name,
            [SATICI ADI] AS supplier_name,
            [ESAS BARKOD] AS barcode,
            0.0 AS sales_price,
            0.0 AS purchase_price,
            ISNULL([Stok miqdari], 0) AS stock_qty
        FROM vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING
        """
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=UserWarning)
            stock_df = pd.read_sql_query(stock_sql, conn)
            
        print(f"Raw Stock fetched ({len(stock_df):,} rows in {time.perf_counter()-t0:.2f}s), aggregating in Pandas...", flush=True)
        t0 = time.perf_counter()
        
        stock_df = stock_df.groupby(['store_code', 'item_code'], as_index=False).agg({
            'item_name': 'first',
            'family_name': 'first',
            'category_name': 'first',
            'sub_category_name': 'first',
            'supplier_name': 'first',
            'barcode': 'first',
            'sales_price': 'first',
            'purchase_price': 'first',
            'stock_qty': 'sum'
        })
        
        stock_df['export_timestamp'] = export_timestamp
        stock_df.to_parquet(STOCK_PARQUET, engine='pyarrow', compression='snappy', index=False)
        stock_time = time.perf_counter() - t0
        stock_size_kb = os.path.getsize(STOCK_PARQUET) / 1024.0
        print(f"Stock Snapshot Saved: {len(stock_df):,} rows | {stock_size_kb:.2f} KB | {stock_time:.2f}s", flush=True)

        # 2. Extract Sales Snapshot
        print(f"Extracting Sales Report ({start_date} to {end_date}) from SQL Server...", flush=True)
        t0 = time.perf_counter()
        sales_sql = f"""
        SELECT 
            CAST([TARIX] AS VARCHAR(10)) AS sale_date,
            CAST([MAGAZA] AS VARCHAR(20)) AS store_code,
            LTRIM(RTRIM(CAST([MEHSUL_KODU] AS VARCHAR(50)))) AS item_code,
            SUM(ISNULL([MIQDARI], 0)) AS sales_qty,
            SUM(ISNULL([SATIS_EDV], 0)) AS sales_amount
        FROM fnc_TS_SALES_REPORT_FOR_PLANNING('{start_date}', '{end_date}')
        GROUP BY [TARIX], CAST([MAGAZA] AS VARCHAR(20)), LTRIM(RTRIM(CAST([MEHSUL_KODU] AS VARCHAR(50))))
        """
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=UserWarning)
            sales_df = pd.read_sql_query(sales_sql, conn)
            
        sales_df['export_timestamp'] = export_timestamp
        sales_df.to_parquet(SALES_PARQUET, engine='pyarrow', compression='snappy', index=False)
        sales_time = time.perf_counter() - t0
        sales_size_kb = os.path.getsize(SALES_PARQUET) / 1024.0
        print(f"Sales Snapshot Saved: {len(sales_df):,} rows | {sales_size_kb:.2f} KB | {sales_time:.2f}s", flush=True)

        # Save metadata summary
        import json
        max_date = str(sales_df['sale_date'].max()) if 'sale_date' in sales_df.columns and not sales_df.empty else None
        meta = {
            "export_timestamp": export_timestamp,
            "stock_rows": len(stock_df),
            "stock_size_kb": round(stock_size_kb, 2),
            "sales_rows": len(sales_df),
            "sales_size_kb": round(sales_size_kb, 2),
            "max_sale_date": max_date,
            "last_synced_dates": [max_date] if max_date else [],
            "execution_time_sec": round(time.perf_counter() - t_start, 2),
            "status": "SUCCESS"
        }
        with open(META_JSON, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

        print(f"ETL Parquet Export Completed Successfully in {meta['execution_time_sec']}s!", flush=True)
        return meta

    except Exception as e:
        print(f"ETL Export Failed: {str(e)}", flush=True)
        raise RuntimeError(f"Parquet cache export failed: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    export_all_to_parquet()
