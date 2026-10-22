import os
import sys
import pyodbc

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import get_db_connection

def main():
    print("=== DIRECT SQL TEST ===", flush=True)
    conn = get_db_connection()
    cursor = conn.cursor()
    print("Connected!", flush=True)

    # 1. Check TS_WHOUSE_STOK_ONLINE for 101 / 100003
    print("\nQuerying TS_WHOUSE_STOK_ONLINE...", flush=True)
    try:
        cursor.execute("SELECT TOP 10 CAST(MAGAZANR AS VARCHAR(20)), CAST(KOD AS VARCHAR(50)), CAST(TARIX AS VARCHAR(20)), STOK FROM TS_WHOUSE_STOK_ONLINE WHERE LTRIM(RTRIM(MAGAZANR)) = '101' AND LTRIM(RTRIM(KOD)) = '100003'")
        rows = cursor.fetchall()
        print(f"TS_WHOUSE_STOK_ONLINE for 101 / 100003 count: {len(rows)}", flush=True)
        for r in rows:
            print(f"  {r[0]} | {r[1]} | {r[2]} | {r[3]}", flush=True)
    except Exception as e:
        print(f"TS_WHOUSE_STOK_ONLINE err: {e}", flush=True)

    # 2. Check TS_WHOUSE_STOK_ONLINE distinct TARIX
    try:
        cursor.execute("SELECT TOP 5 CAST(TARIX AS VARCHAR(20)), COUNT(*) FROM TS_WHOUSE_STOK_ONLINE GROUP BY CAST(TARIX AS VARCHAR(20))")
        rows = cursor.fetchall()
        print("\nTS_WHOUSE_STOK_ONLINE distinct TARIX sample:", flush=True)
        for r in rows:
            print(f"  date: {r[0]} | rows: {r[1]}", flush=True)
    except Exception as e:
        print(f"TS_WHOUSE_STOK_ONLINE TARIX err: {e}", flush=True)

    # 3. Check VW_STOCK_ANALYSIS_DAILY_14DAYS for 101 / 100003
    print("\nQuerying VW_STOCK_ANALYSIS_DAILY_14DAYS...", flush=True)
    try:
        cursor.execute("SELECT TOP 10 TarixGunu, IsYeriKodu, MehsulKodu, StokMiqdari FROM VW_STOCK_ANALYSIS_DAILY_14DAYS WHERE LTRIM(RTRIM(IsYeriKodu)) = '101' AND LTRIM(RTRIM(MehsulKodu)) = '100003'")
        rows = cursor.fetchall()
        print(f"VW_STOCK_ANALYSIS_DAILY_14DAYS for 101 / 100003 count: {len(rows)}", flush=True)
        for r in rows:
            print(f"  {r[0]} | {r[1]} | {r[2]} | {r[3]}", flush=True)
    except Exception as e:
        print(f"VW_STOCK_ANALYSIS_DAILY_14DAYS err: {e}", flush=True)

    # 4. Check VW_STOCK_ANALYSIS_DAILY_14DAYS distinct dates
    try:
        cursor.execute("SELECT TOP 5 TarixGunu, COUNT(*) FROM VW_STOCK_ANALYSIS_DAILY_14DAYS GROUP BY TarixGunu")
        rows = cursor.fetchall()
        print("\nVW_STOCK_ANALYSIS_DAILY_14DAYS distinct dates:", flush=True)
        for r in rows:
            print(f"  date: {r[0]} | rows: {r[1]}", flush=True)
    except Exception as e:
        print(f"VW_STOCK_ANALYSIS_DAILY_14DAYS dates err: {e}", flush=True)

    conn.close()

if __name__ == "__main__":
    main()
