import os
import sys
import pandas as pd

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import get_db_connection

def main():
    conn = get_db_connection()
    cursor = conn.cursor()

    print("--- 1. Testing TS_WHOUSE_STOK_ONLINE ---")
    try:
        sql = """
        SELECT TOP 20 
            CAST(MAGAZANR AS VARCHAR(20)) AS store_code,
            CAST(KOD AS VARCHAR(50)) AS item_code,
            CAST(TARIX AS VARCHAR(20)) AS stock_date,
            STOK AS stock_qty
        FROM TS_WHOUSE_STOK_ONLINE
        """
        df1 = pd.read_sql_query(sql, conn)
        print("TS_WHOUSE_STOK_ONLINE sample:")
        print(df1.to_string())

        sql_dates = "SELECT COUNT(DISTINCT CAST(TARIX AS VARCHAR(20))) AS date_cnt, MIN(CAST(TARIX AS VARCHAR(20))) AS min_d, MAX(CAST(TARIX AS VARCHAR(20))) AS max_d FROM TS_WHOUSE_STOK_ONLINE"
        cursor.execute(sql_dates)
        r = cursor.fetchone()
        print(f"TS_WHOUSE_STOK_ONLINE distinct dates count: {r[0]} | Min date: {r[1]} | Max date: {r[2]}")

        # Check for store 101, item 100003 across dates 2026-10-05 to 2026-10-08
        sql_pair = """
        SELECT CAST(MAGAZANR AS VARCHAR(20)) AS store, CAST(KOD AS VARCHAR(50)) AS item, CAST(TARIX AS VARCHAR(20)) AS date, STOK
        FROM TS_WHOUSE_STOK_ONLINE
        WHERE LTRIM(RTRIM(MAGAZANR)) IN ('101', 'ST-101') AND LTRIM(RTRIM(KOD)) = '100003'
        """
        df_pair = pd.read_sql_query(sql_pair, conn)
        print(f"TS_WHOUSE_STOK_ONLINE for store 101 / item 100003 (rows: {len(df_pair)}):")
        print(df_pair.to_string())
    except Exception as e:
        print(f"Error testing TS_WHOUSE_STOK_ONLINE: {e}")

    print("\n--- 2. Testing VW_STOCK_ANALYSIS_DAILY_14DAYS ---")
    try:
        sql = """
        SELECT TOP 20 *
        FROM VW_STOCK_ANALYSIS_DAILY_14DAYS
        """
        df2 = pd.read_sql_query(sql, conn)
        print("VW_STOCK_ANALYSIS_DAILY_14DAYS sample:")
        print(df2.to_string())

        sql_dates2 = "SELECT COUNT(DISTINCT TarixGunu) AS date_cnt, MIN(TarixGunu) AS min_d, MAX(TarixGunu) AS max_d FROM VW_STOCK_ANALYSIS_DAILY_14DAYS"
        cursor.execute(sql_dates2)
        r2 = cursor.fetchone()
        print(f"VW_STOCK_ANALYSIS_DAILY_14DAYS distinct dates count: {r2[0]} | Min date: {r2[1]} | Max date: {r2[2]}")
    except Exception as e:
        print(f"Error testing VW_STOCK_ANALYSIS_DAILY_14DAYS: {e}")

    conn.close()

if __name__ == "__main__":
    main()
