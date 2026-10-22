import os
import sys
import time
from datetime import datetime
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc

# Backend root
backend_dir = r"C:\Users\Khayal.Aliyev\.gemini\antigravity\scratch\tamstore-promo-intelligence\backend"
sys.path.insert(0, backend_dir)

from app.db import get_db_connection

PARQUET_DIR = os.path.join(backend_dir, "data", "parquet_cache")
SALES_PARQUET = os.path.join(PARQUET_DIR, "sales_snapshot.parquet")
META_JSON = os.path.join(PARQUET_DIR, "cache_metadata.json")

def sync_dates_sales(target_dates):
    if isinstance(target_dates, str):
        target_dates = [target_dates]

    t_start = time.perf_counter()
    print(f"Syncing sales for dates: {target_dates} from SQL Server...")
    
    conn = get_db_connection()
    try:
        frames = []
        for d in target_dates:
            t0 = time.perf_counter()
            sql = f"""
            SELECT 
                CAST([TARIX] AS VARCHAR(10)) AS sale_date,
                CAST([MAGAZA] AS VARCHAR(20)) AS store_code,
                LTRIM(RTRIM(CAST([MEHSUL_KODU] AS VARCHAR(50)))) AS item_code,
                SUM(ISNULL([MIQDARI], 0)) AS sales_qty,
                SUM(ISNULL([SATIS_EDV], 0)) AS sales_amount
            FROM fnc_TS_SALES_REPORT_FOR_PLANNING('{d}', '{d}')
            GROUP BY [TARIX], CAST([MAGAZA] AS VARCHAR(20)), LTRIM(RTRIM(CAST([MEHSUL_KODU] AS VARCHAR(50))))
            """
            df_day = pd.read_sql_query(sql, conn)
            print(f"  Fetched {len(df_day):,} rows for date {d} in {time.perf_counter()-t0:.2f}s")
            frames.append(df_day)
            
        new_sales_df = pd.concat(frames, ignore_index=True)
    finally:
        conn.close()

    export_timestamp = datetime.now().isoformat()
    new_sales_df['export_timestamp'] = export_timestamp
    new_sales_df['sale_date'] = new_sales_df['sale_date'].astype(str)
    new_sales_df['store_code'] = new_sales_df['store_code'].astype(str)
    new_sales_df['item_code'] = new_sales_df['item_code'].astype(str)
    new_sales_df['sales_qty'] = new_sales_df['sales_qty'].astype('float64')
    new_sales_df['sales_amount'] = new_sales_df['sales_amount'].astype('float64')

    print(f"Total new rows to upsert: {len(new_sales_df):,}")

    # Read existing table
    print("Reading existing sales_snapshot.parquet...")
    t0 = time.perf_counter()
    existing_table = pq.read_table(SALES_PARQUET)
    print(f"  Existing rows: {len(existing_table):,} ({time.perf_counter()-t0:.2f}s)")

    # Filter out target dates from existing table
    print(f"Filtering out older records for {target_dates}...")
    t0 = time.perf_counter()
    # build filter: sale_date not in target_dates
    mask = pc.invert(pc.is_in(existing_table['sale_date'], value_set=pa.array(target_dates, type=pa.string())))
    filtered_table = existing_table.filter(mask)
    print(f"  Remaining rows after filter: {len(filtered_table):,} ({time.perf_counter()-t0:.2f}s)")

    # Convert new_sales_df to PyArrow table matching schema
    schema = existing_table.schema
    new_table = pa.Table.from_pandas(new_sales_df, schema=schema, preserve_index=False)

    # Concat tables
    combined_table = pa.concat_tables([filtered_table, new_table])
    print(f"  Combined rows: {len(combined_table):,}")

    # Atomic write to temporary file, then rename
    tmp_path = SALES_PARQUET + ".tmp"
    print(f"Writing updated parquet cache to {tmp_path}...")
    t0 = time.perf_counter()
    pq.write_table(combined_table, tmp_path, compression='snappy')
    print(f"  Written in {time.perf_counter()-t0:.2f}s")

    os.replace(tmp_path, SALES_PARQUET)
    print("Replaced sales_snapshot.parquet successfully!")

    # Update metadata json
    try:
        import json
        meta = {}
        if os.path.exists(META_JSON):
            with open(META_JSON, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        meta["export_timestamp"] = export_timestamp
        meta["sales_rows"] = len(combined_table)
        meta["sales_size_kb"] = round(os.path.getsize(SALES_PARQUET) / 1024.0, 2)
        meta["last_synced_dates"] = target_dates
        meta["max_sale_date"] = max(target_dates)
        with open(META_JSON, 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Warning updating meta.json:", e)

    print(f"Sync complete in {time.perf_counter()-t_start:.2f}s!")
    return len(combined_table)

if __name__ == "__main__":
    from datetime import date, timedelta
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    dates = sys.argv[1:] if len(sys.argv) > 1 else [yesterday]
    sync_dates_sales(dates)
