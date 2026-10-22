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

    # We know fallback driver 'SQL Server' connects
    conn_str = f"DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={uid};PWD={pwd};"
    conn = pyodbc.connect(conn_str, timeout=15)
    cursor = conn.cursor()
    
    results = {}

    print("=======================================================")
    print("--- 1. DATABASE OBJECTS WITH 'TS' or 'PLANNING' ---")
    print("=======================================================")
    cursor.execute("""
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME LIKE '%TS%' OR TABLE_NAME LIKE '%PLANNING%' OR TABLE_NAME LIKE '%STOK%' OR TABLE_NAME LIKE '%STOCK%' OR TABLE_NAME LIKE '%ITEM%'
    ORDER BY TABLE_TYPE, TABLE_NAME
    """)
    objects = cursor.fetchall()
    print(f"Found {len(objects)} tables/views matching keywords:")
    for o in objects:
        print(f"  [{o[2]}] {o[0]}.{o[1]}")
    results['matching_objects'] = [{"schema": o[0], "name": o[1], "type": o[2]} for o in objects]

    print("\n=======================================================")
    print("--- 2. COLUMNS OF vw_TS_ITEMS_DETAIL_FOR_PLANNING ---")
    print("=======================================================")
    cursor.execute("""
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'vw_TS_ITEMS_DETAIL_FOR_PLANNING'
    ORDER BY ORDINAL_POSITION
    """)
    cols = cursor.fetchall()
    col_info = [{"name": c[0], "type": c[1], "len": c[2], "nullable": c[3]} for c in cols]
    results['vw_TS_ITEMS_DETAIL_FOR_PLANNING_columns'] = col_info
    print(f"Total Columns: {len(col_info)}")
    for c in col_info:
        len_s = f"({c['len']})" if c['len'] else ""
        print(f"  - {c['name']} ({c['type']}{len_s})")

    print("\n=======================================================")
    print("--- 3. SAMPLE DATA TOP 20: vw_TS_ITEMS_DETAIL_FOR_PLANNING ---")
    print("=======================================================")
    cursor.execute("SELECT TOP 20 * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)")
    col_names = [column[0] for column in cursor.description]
    sample_rows = cursor.fetchall()
    sample_list = [{col_names[i]: (str(r[i]) if r[i] is not None else None) for i in range(len(col_names))} for r in sample_rows]
    results['vw_TS_ITEMS_DETAIL_FOR_PLANNING_sample'] = sample_list
    print(f"Fetched {len(sample_list)} rows.")
    print("Columns:", col_names[:10], "... (total", len(col_names), ")")
    if sample_list:
        print("Row #1 Sample:", json.dumps(sample_list[0], indent=2, ensure_ascii=False)[:600])

    print("\n=======================================================")
    print("--- 4. DUPLICATE DIAGNOSIS ON vw_TS_ITEMS_DETAIL_FOR_PLANNING ---")
    print("=======================================================")
    # Fast duplicate diagnosis on a TOP 50000 subset to avoid full table lock/scan hangs
    dup_fast_query = """
    SELECT TOP 10 [IS YERI NO], [URUN KODU], COUNT(*) as cnt
    FROM (SELECT TOP 50000 [IS YERI NO], [URUN KODU] FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)) sub
    GROUP BY [IS YERI NO], [URUN KODU]
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    """
    cursor.execute(dup_fast_query)
    dup_groups = cursor.fetchall()
    print(f"Duplicate (IS YERI NO, URUN KODU) groups found in top 50,000 rows: {len(dup_groups)}")
    for g in dup_groups:
        print(f"  IS YERI NO: {g[0]}, URUN KODU: {g[1]} -> Count: {g[2]}")
    results['duplicate_groups_sample'] = [{"is_yeri_no": str(g[0]), "urun_kodu": str(g[1]), "cnt": g[2]} for g in dup_groups]

    dup_details = []
    if dup_groups:
        for g in dup_groups[:3]:
            st, cd = str(g[0]), str(g[1])
            print(f"\n--- Detailed rows for Duplicate Group: IS YERI NO='{st}', URUN KODU='{cd}' ---")
            detail_q = "SELECT TOP 10 * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK) WHERE [IS YERI NO] = ? AND [URUN KODU] = ?"
            cursor.execute(detail_q, (st, cd))
            d_rows = cursor.fetchall()
            d_list = [{col_names[i]: (str(r[i]) if r[i] is not None else None) for i in range(len(col_names))} for r in d_rows]
            dup_details.append({"is_yeri_no": st, "urun_kodu": cd, "rows": d_list})
            
            diff_cols = {}
            if len(d_list) > 1:
                for col in col_names:
                    vals = set(r[col] for r in d_list)
                    if len(vals) > 1:
                        diff_cols[col] = list(vals)
            print("  Differing columns between duplicate rows:")
            for dc, vals in diff_cols.items():
                print(f"    - [{dc}]: {vals}")
    else:
        print("  No duplicates found in top 50,000 rows! Checking if duplicates exist across entire view using fast index or count...")
        # Check overall count vs distinct count
        cursor.execute("SELECT COUNT(*) FROM (SELECT TOP 100000 1 FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)) sub")
        cnt1 = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM (SELECT DISTINCT TOP 100000 [IS YERI NO], [URUN KODU] FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)) sub")
        cnt2 = cursor.fetchone()[0]
        print(f"  Count in 100k sample: Total={cnt1}, Distinct (IS YERI NO, URUN KODU)={cnt2}")

    results['duplicate_details'] = dup_details

    print("\n=======================================================")
    print("--- 5. fnc_TS_SALES_REPORT_FOR_PLANNING PARAMETERS ---")
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

    print("\n=======================================================")
    print("--- 6. fnc_TS_SALES_REPORT_FOR_PLANNING SAMPLE CALL ---")
    print("=======================================================")
    # Construct call based on parameters found
    call_sql = "SELECT TOP 20 * FROM fnc_TS_SALES_REPORT_FOR_PLANNING('2026-09-03', '2026-09-07')"
    print(f"Executing: {call_sql}")
    try:
        cursor.execute(call_sql)
        sales_cols = [column[0] for column in cursor.description]
        sales_rows = cursor.fetchall()
        sales_list = [{sales_cols[i]: (str(r[i]) if r[i] is not None else None) for i in range(len(sales_cols))} for r in sales_rows]
        results['fnc_TS_SALES_REPORT_FOR_PLANNING_columns'] = sales_cols
        results['fnc_TS_SALES_REPORT_FOR_PLANNING_sample'] = sales_list
        print(f"Returned {len(sales_list)} rows.")
        print("Sales Columns:", sales_cols)
        if sales_list:
            print("\nFirst Sales Row Sample:")
            print(json.dumps(sales_list[0], indent=2, ensure_ascii=False))
    except Exception as e:
        print("Error executing function call:", e)
        results['sales_func_error'] = str(e)

    # Save to json file
    with open(os.path.join(backend_dir, 'faza1_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n✅ Fast investigation script complete. Saved to backend/faza1_summary.json")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
