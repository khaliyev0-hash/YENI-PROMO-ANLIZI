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
    print("--- 1. DUPLICATE DIAGNOSIS (ROW_NUMBER method) ---")
    print("=======================================================")
    cursor.execute("SELECT TOP 100 * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)")
    col_names = [c[0] for c in cursor.description]

    dup_q = """
    WITH CTE AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY [IS YERI NO], [URUN KODU] ORDER BY (SELECT NULL)) as rnum
        FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)
    )
    SELECT TOP 20 [IS YERI NO], [URUN KODU]
    FROM CTE
    WHERE rnum > 1
    """
    cursor.execute(dup_q)
    dup_pairs = cursor.fetchall()
    print(f"Found duplicate (IS YERI NO, URUN KODU) pairs: {len(dup_pairs)}")
    for p in dup_pairs:
        print(f"  Duplicate Pair: IS YERI NO='{p[0]}', URUN KODU='{p[1]}'")

    dup_samples = []
    if dup_pairs:
        for p in dup_pairs[:3]:
            st, cd = str(p[0]), str(p[1])
            print(f"\n--- ALL Rows for Duplicate Pair (IS YERI NO='{st}', URUN KODU='{cd}') ---")
            cursor.execute("SELECT * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK) WHERE [IS YERI NO] = ? AND [URUN KODU] = ?", (st, cd))
            rows = cursor.fetchall()
            r_dicts = [{col_names[i]: (str(r[i]) if r[i] is not None else None) for i in range(len(col_names))} for r in rows]
            dup_samples.append({"is_yeri_no": st, "urun_kodu": cd, "rows_count": len(r_dicts), "rows": r_dicts})
            print(f"  Rows count for this pair: {len(r_dicts)}")
            
            # Find differing columns
            diff_cols = {}
            for col in col_names:
                vals = set(r[col] for r in r_dicts)
                if len(vals) > 1:
                    diff_cols[col] = list(vals)
            print("  DIFFERING COLUMNS between duplicate rows:")
            for col, vals in diff_cols.items():
                print(f"    - [{col}]: {vals}")
    else:
        print("  No duplicate (IS YERI NO, URUN KODU) pairs found in view! Each (IS YERI NO, URUN KODU) pair is unique.")

    results['duplicate_analysis'] = dup_samples

    print("\n=======================================================")
    print("--- 2. fnc_TS_SALES_REPORT_FOR_PLANNING PARAMETERS ---")
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

    # Also check function definition type (Inline TVF vs Multi-statement TVF vs Scalar)
    cursor.execute("SELECT type, type_desc FROM sys.objects WHERE name = 'fnc_TS_SALES_REPORT_FOR_PLANNING'")
    f_type = cursor.fetchone()
    if f_type:
        print(f"Function Type: {f_type[0]} ({f_type[1]})")
        results['function_type'] = {"type_code": f_type[0], "type_desc": f_type[1]}

    print("\n=======================================================")
    print("--- 3. fnc_TS_SALES_REPORT_FOR_PLANNING TEST CALL ---")
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
        print("Sales Function Columns:")
        for idx, sc in enumerate(sales_cols, 1):
            print(f"  {idx:2d}. {sc}")
        if sales_list:
            print("\nFirst Sales Sample Row Preview:")
            for k, v in list(sales_list[0].items()):
                print(f"  {k}: {v}")
    except Exception as e:
        print("Error executing sales function:", e)
        results['sales_func_error'] = str(e)

    # Search database for stock views/tables if stock column is not in item view
    print("\n=======================================================")
    print("--- 4. CHECKING OTHER STOCK / INVENTORY VIEWS ---")
    print("=======================================================")
    cursor.execute("""
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_NAME LIKE '%TS_%' OR TABLE_NAME LIKE '%STOCK%' OR TABLE_NAME LIKE '%STOK%')
      AND (COLUMN_NAME LIKE '%STOK%' OR COLUMN_NAME LIKE '%QALIQ%' OR COLUMN_NAME LIKE '%QTY%' OR COLUMN_NAME LIKE '%STOCK%')
    ORDER BY TABLE_NAME, COLUMN_NAME
    """)
    stock_cols = cursor.fetchall()
    print(f"Found {len(stock_cols)} stock-related columns in database views/tables:")
    for sc in stock_cols[:30]:
        print(f"  [{sc[0]}] -> Column: {sc[1]} ({sc[2]})")
    results['stock_columns_in_db'] = [{"table": sc[0], "column": sc[1], "type": sc[2]} for sc in stock_cols]

    with open(os.path.join(backend_dir, 'faza1_final_output.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n✅ FAZA 1 Investigation Complete! Saved to backend/faza1_final_output.json")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
