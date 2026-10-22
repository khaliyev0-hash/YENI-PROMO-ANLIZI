import os
import pyodbc
import pandas as pd

def load_env_file():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()

load_env_file()

db_driver = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
db_server = os.getenv("DB_SERVER", "cltmdb03")
db_name = os.getenv("DB_NAME", "Ltamstore")
db_uid = os.getenv("DB_UID", "lgn_planning")
db_pwd = os.getenv("DB_PWD", "l@n_pl@n!ng202%")

def get_connection():
    drivers = [db_driver, "SQL Server", "SQL Server Native Client 11.0", "ODBC Driver 18 for SQL Server"]
    for driver in drivers:
        try:
            conn_str = f"DRIVER={{{driver}}};SERVER={db_server};DATABASE={db_name};UID={db_uid};PWD={db_pwd};"
            conn = pyodbc.connect(conn_str, timeout=5)
            print(f"Successfully connected with driver: {driver}")
            return conn
        except Exception as e:
            continue
    raise RuntimeError("Failed to connect to SQL Server with available drivers.")

conn = get_connection()

sql_query = """
WITH SalesData AS (
    SELECT 
        [TARIX] AS sale_date,
        LTRIM(RTRIM(CAST([MAGAZA] AS VARCHAR(20)))) AS store_code,
        LTRIM(RTRIM([MEHSUL_KODU])) AS item_code,
        SUM(ISNULL([MIQDARI], 0)) AS sales_qty,
        SUM(ISNULL([SATIS_EDV], 0)) AS sales_amount
    FROM fnc_TS_SALES_REPORT_FOR_PLANNING(?, ?)
    GROUP BY [TARIX], LTRIM(RTRIM(CAST([MAGAZA] AS VARCHAR(20)))), LTRIM(RTRIM([MEHSUL_KODU]))
),
DedupItems AS (
    SELECT 
        LTRIM(RTRIM([IS YERI NO])) AS store_code,
        LTRIM(RTRIM([URUN KODU])) AS item_code,
        [URUN AD] AS item_name,
        [FAMILY NAME] AS family_name,
        [CATEGORY NAME] AS category_name,
        [SUB CATEGORY NAME] AS sub_category_name,
        [SATICI ADI] AS supplier_name,
        [ESAS BARKOD] AS barcode,
        [SATIS QIYMETI] AS sales_price,
        [ALIS QIYMETI] AS purchase_price,
        ROW_NUMBER() OVER (
            PARTITION BY [IS YERI NO], [URUN KODU] 
            ORDER BY 
                CASE WHEN [TEDARİKCİ BLOKAJİ] LIKE 'XEYR%' THEN 0 ELSE 1 END,
                [ALIS ILK TARIX] DESC
        ) AS rn
    FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING
),
StockData AS (
    SELECT 
        LTRIM(RTRIM([IS YERI NO])) AS store_code,
        LTRIM(RTRIM([URUN KODU])) AS item_code,
        SUM(ISNULL([Stok miqdari], 0)) AS stock_qty
    FROM vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING
    GROUP BY LTRIM(RTRIM([IS YERI NO])), LTRIM(RTRIM([URUN KODU]))
)
SELECT TOP 50
    s.sale_date,
    s.store_code,
    s.item_code,
    COALESCE(i.item_name, s.item_code) AS item_name,
    i.family_name,
    i.category_name,
    i.sub_category_name,
    i.supplier_name,
    i.barcode,
    i.sales_price,
    i.purchase_price,
    s.sales_qty,
    s.sales_amount,
    COALESCE(st.stock_qty, 0) AS current_stock
FROM SalesData s
LEFT JOIN DedupItems i 
    ON s.store_code = i.store_code AND s.item_code = i.item_code AND i.rn = 1
LEFT JOIN StockData st 
    ON s.store_code = st.store_code AND s.item_code = st.item_code
"""

beg_date = '2026-09-03'
end_date = '2026-09-07'

df = pd.read_sql_query(sql_query, conn, params=[beg_date, end_date])
print(f"Query returned {len(df)} rows.")
print("Sample rows:")
print(df.head(10).to_string())

conn.close()
