import os
import sys
import pyodbc
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def load_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    env = load_env(os.path.join(backend_dir, '.env'))
    
    server = env.get('DB_SERVER', 'cltmdb03')
    database = env.get('DB_NAME', 'Ltamstore')
    uid = env.get('DB_UID', 'lgn_planning')
    pwd = env.get('DB_PWD', 'l@n_pl@n!ng202%')

    conn_str = f"DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={uid};PWD={pwd};"
    conn = pyodbc.connect(conn_str, timeout=15)
    cursor = conn.cursor()
    
    results = {}

    print("=======================================================")
    print("--- 1. fnc_TS_SALES_REPORT_FOR_PLANNING PARAMETERS ---")
    print("=======================================================")
    cursor.execute("""
    SELECT 
        p.name AS param_name,
        p.parameter_id,
        t.name AS data_type,
        p.max_length,
        p.precision,
        p.scale,
        p.is_output
    FROM sys.parameters p
    JOIN sys.types t ON p.system_type_id = t.system_type_id AND p.user_type_id = t.user_type_id
    WHERE p.object_id = OBJECT_ID('fnc_TS_SALES_REPORT_FOR_PLANNING')
    ORDER BY p.parameter_id
    """)
    params = cursor.fetchall()
    param_list = [
        {"param_name": p[0], "parameter_id": p[1], "data_type": p[2], "max_length": p[3]}
        for p in params
    ]
    results['fnc_TS_SALES_REPORT_FOR_PLANNING_parameters'] = param_list
    print(f"Parameters Count: {len(param_list)}")
    for p in param_list:
        print(f"  Param #{p['parameter_id']}: {p['param_name']} ({p['data_type']})")

    cursor.execute("SELECT type, type_desc FROM sys.objects WHERE name = 'fnc_TS_SALES_REPORT_FOR_PLANNING'")
    f_type = cursor.fetchone()
    if f_type:
        print(f"Function Type: {f_type[0]} ({f_type[1]})")
        results['function_type'] = {"type_code": f_type[0], "type_desc": f_type[1]}

    print("\n=======================================================")
    print("--- 2. fnc_TS_SALES_REPORT_FOR_PLANNING CALL & COLUMNS ---")
    print("=======================================================")
    sales_q = "SELECT TOP 20 * FROM fnc_TS_SALES_REPORT_FOR_PLANNING('2026-09-03', '2026-09-07')"
    print(f"Executing Query: {sales_q}")
    try:
        cursor.execute(sales_q)
        sales_cols = [c[0] for c in cursor.description]
        sales_rows = cursor.fetchall()
        sales_list = [{sales_cols[i]: (str(r[i]) if r[i] is not None else None) for i in range(len(sales_cols))} for r in sales_rows]
        results['fnc_TS_SALES_REPORT_FOR_PLANNING_columns'] = sales_cols
        results['fnc_TS_SALES_REPORT_FOR_PLANNING_sample'] = sales_list
        print(f"Returned {len(sales_list)} sample rows.")
        print(f"Sales Function Columns ({len(sales_cols)}):")
        for idx, sc in enumerate(sales_cols, 1):
            print(f"  {idx:2d}. {sc}")
        if sales_list:
            print("\nFirst Sales Sample Row:")
            for k, v in sales_list[0].items():
                print(f"  {k}: {v}")
    except Exception as e:
        print("Error executing sales function:", e)
        results['sales_func_error'] = str(e)

    print("\n=======================================================")
    print("--- 3. CHECKING STOCK VIEWS FOR STOK COLUMN ---")
    print("=======================================================")
    # Check vw_TS_WHOUSE_STOK_ONLINE, VW_STOCK_ANALYSIS_DAILY_14DAYS, vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING
    views_to_check = [
        'vw_TS_WHOUSE_STOK_ONLINE',
        'VW_STOCK_ANALYSIS_DAILY_14DAYS',
        'vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING',
        'VW_TS_DEPO_STOCK_ANALIZI'
    ]
    for vname in views_to_check:
        print(f"\nColumns for View [{vname}]:")
        try:
            cursor.execute(f"SELECT TOP 1 * FROM {vname} WITH (NOLOCK)")
            v_cols = [c[0] for c in cursor.description]
            v_row = cursor.fetchone()
            print(f"  Total Columns: {len(v_cols)}")
            print(f"  Columns: {v_cols}")
            if v_row:
                v_dict = {v_cols[i]: (str(v_row[i]) if v_row[i] is not None else None) for i in range(len(v_cols))}
                print("  Sample Row:", v_dict)
            results[f'{vname}_info'] = {"columns": v_cols, "sample": v_dict if v_row else None}
        except Exception as ve:
            print(f"  Could not query {vname}: {ve}")

    print("\n=======================================================")
    print("--- 4. FAST DUPLICATE DIAGNOSIS ON vw_TS_ITEMS_DETAIL_FOR_PLANNING ---")
    print("=======================================================")
    # Test duplicates in a sample batch of 2000 rows
    dup_fast_q = """
    SELECT [IS YERI NO], [URUN KODU], COUNT(*) as cnt
    FROM (SELECT TOP 5000 [IS YERI NO], [URUN KODU] FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)) t
    GROUP BY [IS YERI NO], [URUN KODU]
    HAVING COUNT(*) > 1
    """
    cursor.execute(dup_fast_q)
    dup_rows = cursor.fetchall()
    print(f"Duplicates in 5,000 sample rows: {len(dup_rows)}")
    for dr in dup_rows:
        print(f"  IS YERI NO={dr[0]}, URUN KODU={dr[1]} -> Count={dr[2]}")

    # Check for specific items sample rows (e.g. URUN KODU = '100001')
    cursor.execute("SELECT TOP 5 * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK) WHERE [URUN KODU] = '100001'")
    sample_100001 = cursor.fetchall()
    cols_100001 = [c[0] for c in cursor.description]
    print(f"\nRows found for URUN KODU='100001': {len(sample_100001)}")
    for r in sample_100001:
        print("  Store:", r[cols_100001.index('IS YERI NO')], "| Code:", r[cols_100001.index('URUN KODU')], "| Barcode:", r[cols_100001.index('ESAS BARKOD')], "| Vendor:", r[cols_100001.index('SATICI ADI')])

    with open(os.path.join(backend_dir, 'faza1_direct_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n✅ Fast direct investigation script complete! Saved to backend/faza1_direct_summary.json")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
