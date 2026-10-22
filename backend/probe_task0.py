import time
import pandas as pd
from sqlalchemy import create_engine
from app.db import get_db_connection

def get_sqlalchemy_engine():
    return create_engine("mssql+pyodbc://", creator=get_db_connection)

def run_probe():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. IsInlineFunction
    cursor.execute("SELECT OBJECTPROPERTY(OBJECT_ID('fnc_TS_SALES_REPORT_FOR_PLANNING'), 'IsInlineFunction')")
    is_inline = cursor.fetchone()[0]
    print(f"1. IsInlineFunction: {is_inline}")

    # 2. Columns / types
    cursor.execute("SELECT TOP 1 * FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING('2026-10-01', '2026-10-01')")
    cols = [column[0] for column in cursor.description]
    types = [str(column[1].__name__) for column in cursor.description]
    print(f"2. Columns & Types:")
    for c, t in zip(cols, types):
        print(f"   - {c}: {t}")

    # Check grain: aggregated vs transaction level
    cursor.execute("""
        SELECT COUNT(*) as total_rows, 
               COUNT(DISTINCT CONCAT(CAST(MAGAZA AS VARCHAR), '_', CAST(MEHSUL_KODU AS VARCHAR))) as unique_pairs
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING('2026-10-01', '2026-10-01')
    """)
    total_r, unique_p = cursor.fetchone()
    print(f"   Grain analysis for 2026-10-01:")
    print(f"   - Total rows in function output: {total_r}")
    print(f"   - Unique (MAGAZA, MEHSUL_KODU) pairs: {unique_p}")
    is_daily_grain = (total_r == unique_p)
    print(f"   - Already daily per (store, item)?: {is_daily_grain}")

    conn.close()

    # 3. Aggregated query performance for ONE day and ONE 7-day range
    engine = get_sqlalchemy_engine()

    agg_sql_template = """
        SELECT 
            CAST(TARIX AS DATE) as sale_date,
            CAST(MAGAZA AS VARCHAR(50)) as store_code,
            CAST(MEHSUL_KODU AS VARCHAR(50)) as item_code,
            SUM(CAST(MIQDARI AS FLOAT)) as sales_qty,
            SUM(CAST(SATIS_EDV AS FLOAT)) as sales_amount
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING('{beg}', '{end}')
        GROUP BY CAST(TARIX AS DATE), CAST(MAGAZA AS VARCHAR(50)), CAST(MEHSUL_KODU AS VARCHAR(50))
    """

    # ONE day test: 2026-10-01
    print("\n3. Performance Probe:")
    t0 = time.perf_counter()
    df_1day = pd.read_sql_query(agg_sql_template.format(beg='2026-10-01', end='2026-10-01'), engine)
    t1_day = time.perf_counter() - t0
    rows_1day = len(df_1day)
    print(f"   - 1 Day (2026-10-01): {rows_1day} rows in {t1_day:.2f}s")

    # ONE 7-day test: 2026-09-25 to 2026-10-01
    t0 = time.perf_counter()
    df_7day = pd.read_sql_query(agg_sql_template.format(beg='2026-09-25', end='2026-10-01'), engine)
    t7_day = time.perf_counter() - t0
    rows_7day = len(df_7day)
    print(f"   - 7 Days (2026-09-25 to 2026-10-01): {rows_7day} rows in {t7_day:.2f}s (avg {t7_day/7:.2f}s/day)")

    # Extrapolation for 3 months (90 days)
    avg_rows_per_day = rows_1day
    est_total_rows_90d = int(avg_rows_per_day * 90)
    
    est_runtime_1day_chunks = (t1_day + 0.5) * 90
    est_runtime_7day_chunks = (t7_day + 0.5) * (90 / 7)

    print(f"\nExtrapolation for 3 Months (90 days):")
    print(f"   - Estimated Total Rows: ~{est_total_rows_90d:,}")
    print(f"   - Est Runtime (1-day chunks): {est_runtime_1day_chunks/60:.2f} minutes ({est_runtime_1day_chunks:.1f}s)")
    print(f"   - Est Runtime (7-day chunks): {est_runtime_7day_chunks/60:.2f} minutes ({est_runtime_7day_chunks:.1f}s)")
    
    chunk_choice = "1 day" if (est_runtime_1day_chunks <= est_runtime_7day_chunks or est_runtime_1day_chunks < 300) else "7 days"
    print(f"   - Chosen Chunk Size: {chunk_choice}")

if __name__ == "__main__":
    run_probe()
