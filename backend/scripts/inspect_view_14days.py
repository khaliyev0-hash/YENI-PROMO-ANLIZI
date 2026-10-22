import os
import sys
import pyodbc

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import get_db_connection

def main():
    conn = get_db_connection()
    cursor = conn.cursor()

    print("=== INSPECTING VW_STOCK_ANALYSIS_DAILY_14DAYS ===", flush=True)

    # 1. Distinct dates in VW_STOCK_ANALYSIS_DAILY_14DAYS
    cursor.execute("SELECT DISTINCT TarixGunu FROM VW_STOCK_ANALYSIS_DAILY_14DAYS ORDER BY TarixGunu")
    dates = [str(r[0])[:10] for r in cursor.fetchall()]
    print(f"Dates in VW_STOCK_ANALYSIS_DAILY_14DAYS ({len(dates)} days):", dates, flush=True)

    # 2. Store 101, Item 100003 for 2026-10-05..2026-10-08
    sql = """
    SELECT TarixGunu, IsYeriKodu, MehsulKodu, MehsulAdi, StokMiqdari, StokTutari
    FROM VW_STOCK_ANALYSIS_DAILY_14DAYS
    WHERE LTRIM(RTRIM(IsYeriKodu)) = '101' AND LTRIM(RTRIM(MehsulKodu)) = '100003'
      AND TarixGunu BETWEEN '2026-10-05' AND '2026-10-08'
    ORDER BY TarixGunu
    """
    cursor.execute(sql)
    rows = cursor.fetchall()
    print("\nStore 101 / Item 100003 for dates 2026-10-05..2026-10-08:", flush=True)
    for r in rows:
        print(f"  Tarix: {r[0]} | Store: {r[1]} | Item: {r[2]} | Name: {r[3]} | StokMiqdari: {r[4]} | StokTutari: {r[5]}", flush=True)

    # 3. Check 2 other pairs with stock changes across days
    sql2 = """
    SELECT TOP 10 IsYeriKodu, MehsulKodu, COUNT(DISTINCT StokMiqdari) AS stock_variations
    FROM VW_STOCK_ANALYSIS_DAILY_14DAYS
    GROUP BY IsYeriKodu, MehsulKodu
    HAVING COUNT(DISTINCT StokMiqdari) > 1
    """
    cursor.execute(sql2)
    var_pairs = cursor.fetchall()
    print("\nSample pairs with varying stock across days in VW_STOCK_ANALYSIS_DAILY_14DAYS:", flush=True)
    for vp in var_pairs[:3]:
        st, cd, cnt = vp[0], vp[1], vp[2]
        print(f"\nPair (store: {st}, item: {cd}) - distinct stock values: {cnt}:", flush=True)
        sql_detail = f"""
        SELECT TarixGunu, StokMiqdari
        FROM VW_STOCK_ANALYSIS_DAILY_14DAYS
        WHERE IsYeriKodu = '{st}' AND MehsulKodu = '{cd}'
        ORDER BY TarixGunu
        """
        cursor.execute(sql_detail)
        for dr in cursor.fetchall():
            print(f"  Date: {dr[0]} | Stock: {dr[1]}", flush=True)

    conn.close()

if __name__ == "__main__":
    main()
