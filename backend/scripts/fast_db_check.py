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

    print("=======================================================")
    print("FAST SQL SERVER OBJECT CHECK FOR HISTORICAL DAILY STOCK")
    print("=======================================================")

    # 1. TS_WHOUSE_STOK_ONLINE
    print("\n--- 1. TS_WHOUSE_STOK_ONLINE ---")
    try:
        cursor.execute("SELECT TOP 5 CAST(MAGAZANR AS VARCHAR(20)), CAST(KOD AS VARCHAR(50)), CAST(TARIX AS VARCHAR(20)), STOK FROM TS_WHOUSE_STOK_ONLINE")
        rows = cursor.fetchall()
        print("Sample rows (store, item, date, stock):")
        for r in rows:
            print(f"  store: {r[0]} | item: {r[1]} | date: {r[2]} | stock: {r[3]}")
            
        cursor.execute("SELECT COUNT(DISTINCT CAST(TARIX AS VARCHAR(20))) FROM TS_WHOUSE_STOK_ONLINE")
        print("Distinct dates count in TS_WHOUSE_STOK_ONLINE:", cursor.fetchone()[0])
    except Exception as e:
        print("Error checking TS_WHOUSE_STOK_ONLINE:", e)

    # 2. VW_STOCK_ANALYSIS_DAILY_14DAYS
    print("\n--- 2. VW_STOCK_ANALYSIS_DAILY_14DAYS ---")
    try:
        cursor.execute("SELECT TOP 5 * FROM VW_STOCK_ANALYSIS_DAILY_14DAYS")
        cols = [c[0] for c in cursor.description]
        print("Columns:", cols)
        rows = cursor.fetchall()
        for r in rows:
            print("  ", r)
        cursor.execute("SELECT COUNT(DISTINCT TarixGunu) FROM VW_STOCK_ANALYSIS_DAILY_14DAYS")
        print("Distinct dates count in VW_STOCK_ANALYSIS_DAILY_14DAYS:", cursor.fetchone()[0])
    except Exception as e:
        print("Error checking VW_STOCK_ANALYSIS_DAILY_14DAYS:", e)

    # 3. Search for any table or view that has daily stock snapshot history
    print("\n--- 3. Checking all views definition for historical stock tables ---")
    sql_views = """
    SELECT sys.views.name, sys.schemas.name
    FROM sys.views
    JOIN sys.schemas ON sys.views.schema_id = sys.schemas.schema_id
    WHERE sys.views.name LIKE '%STOK%' OR sys.views.name LIKE '%STOCK%' OR sys.views.name LIKE '%BALANCE%' OR sys.views.name LIKE '%SNAPSHOT%' OR sys.views.name LIKE '%HEREKET%'
    """
    cursor.execute(sql_views)
    views = cursor.fetchall()
    print("Found matching views:", [f"{r[1]}.{r[0]}" for r in views])

    for v_schema, v_name in views:
        full_v = f"[{v_schema}].[{v_name}]"
        try:
            cursor.execute(f"SELECT TOP 1 * FROM {full_v}")
            cols = [c[0] for c in cursor.description]
            print(f"\nView {full_v} cols: {cols}")
        except Exception as e:
            print(f"Could not inspect {full_v}: {e}")

    conn.close()

if __name__ == "__main__":
    main()
