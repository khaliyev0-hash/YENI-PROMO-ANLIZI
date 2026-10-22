import os
import sys
import pyodbc
import json

# Ensure stdout uses UTF-8 encoding for Turkish/Azerbaijani characters
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

def get_connection(env):
    driver = env.get('DB_DRIVER', 'ODBC Driver 17 for SQL Server')
    server = env.get('DB_SERVER', 'cltmdb03')
    database = env.get('DB_NAME', 'Ltamstore')
    uid = env.get('DB_UID', 'lgn_planning')
    pwd = env.get('DB_PWD', 'l@n_pl@n!ng202%')

    # Try requested driver first
    conn_str = f"DRIVER={{{driver}}};SERVER={server};DATABASE={database};UID={uid};PWD={pwd};"
    print(f"Connecting with driver: '{driver}' to server: '{server}', db: '{database}'...")
    
    try:
        conn = pyodbc.connect(conn_str, timeout=10)
        print(f"Successfully connected using: {driver}")
        return conn, driver
    except Exception as e:
        print(f"Failed with driver '{driver}': {e}")
        # Try fallback drivers
        drivers_to_try = [d for d in pyodbc.drivers() if 'SQL Server' in d or 'ODBC' in d]
        print(f"Available system ODBC drivers: {pyodbc.drivers()}")
        for alt_driver in drivers_to_try:
            if alt_driver == driver:
                continue
            alt_conn_str = f"DRIVER={{{alt_driver}}};SERVER={server};DATABASE={database};UID={uid};PWD={pwd};"
            print(f"Attempting fallback driver: '{alt_driver}'...")
            try:
                conn = pyodbc.connect(alt_conn_str, timeout=10)
                print(f"Successfully connected using fallback driver: {alt_driver}")
                return conn, alt_driver
            except Exception as alt_e:
                print(f"Failed with '{alt_driver}': {alt_e}")
        raise e

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(backend_dir, '.env')
    env = load_env(env_path)
    
    conn, used_driver = get_connection(env)
    cursor = conn.cursor()
    
    print("\n=======================================================")
    print("--- ADDIM 0: DB CONNECTION TEST ---")
    print("=======================================================")
    cursor.execute("SELECT 1")
    row = cursor.fetchone()
    print("SELECT 1 Result:", row[0])
    print(f"Connection Status: SUCCESSFUL (Driver: {used_driver})")
    
    results = {
        "used_driver": used_driver
    }

    print("\n=======================================================")
    print("--- FAZA 1.1: vw_TS_ITEMS_DETAIL_FOR_PLANNING COLUMNS ---")
    print("=======================================================")
    columns_query = """
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'vw_TS_ITEMS_DETAIL_FOR_PLANNING'
    ORDER BY ORDINAL_POSITION
    """
    cursor.execute(columns_query)
    columns_info = [
        {"column_name": r[0], "data_type": r[1], "max_len": r[2], "nullable": r[3]}
        for r in cursor.fetchall()
    ]
    results['vw_TS_ITEMS_DETAIL_FOR_PLANNING_columns'] = columns_info
    print(f"Total Columns Count: {len(columns_info)}")
    for idx, c in enumerate(columns_info, 1):
        len_str = f"({c['max_len']})" if c['max_len'] else ""
        print(f"  {idx:2d}. {c['column_name']} ({c['data_type']}{len_str}) - Nullable: {c['nullable']}")

    print("\n=======================================================")
    print("--- FAZA 1.2: vw_TS_ITEMS_DETAIL_FOR_PLANNING SAMPLE ROWS (TOP 20) ---")
    print("=======================================================")
    cursor.execute("SELECT TOP 20 * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING")
    col_names = [column[0] for column in cursor.description]
    rows = cursor.fetchall()
    results['vw_TS_ITEMS_DETAIL_FOR_PLANNING_col_names'] = col_names
    sample_rows = []
    for r in rows:
        row_dict = {}
        for col_name, val in zip(col_names, r):
            row_dict[col_name] = str(val) if val is not None else None
        sample_rows.append(row_dict)
    results['vw_TS_ITEMS_DETAIL_FOR_PLANNING_sample_rows'] = sample_rows
    print(f"Fetched {len(sample_rows)} sample rows.")
    print("Column names:", col_names)
    print("\nFirst sample row preview:")
    for k, v in list(sample_rows[0].items())[:15]:
        print(f"  {k}: {v}")

    # Column mapping identification
    print("\n=======================================================")
    print("--- COLUMN MAPPING IDENTIFICATION ---")
    print("=======================================================")
    # Let's inspect column names to locate store, product code, stock
    print("All column names in view:")
    for cn in col_names:
        print(f"  - '{cn}'")

    # Pick store column and product code column from actual columns
    # Common column names in Turkish / Nebim: 'IS YERI NO' or 'MAGAZA_KODU' or 'ISYERI', 'URUN KODU' or 'MEHSUL_KODU', 'STOK', 'MIQTAR', 'QALIQ', 'FINAL_STOCK'
    store_col = next((c for c in col_names if 'IS YERI' in c.upper() or 'MAGAZA' in c.upper() or 'STORE' in c.upper() or 'ANBAR' in c.upper()), col_names[0])
    code_col = next((c for c in col_names if 'URUN KOD' in c.upper() or 'ITEM_CODE' in c.upper() or 'MEHSUL_KOD' in c.upper() or 'BARKOD' in c.upper()), col_names[1])
    stock_col = [c for c in col_names if 'STOK' in c.upper() or 'QALIQ' in c.upper() or 'STOCK' in c.upper() or 'QTY' in c.upper() or 'ENVERTER' in c.upper() or 'ENVANTER' in c.upper()]

    print(f"\nIdentified Store Column candidate: [{store_col}]")
    print(f"Identified Code Column candidate:  [{code_col}]")
    print(f"Identified Stock Column candidates: {stock_col}")

    print("\n=======================================================")
    print(f"--- FAZA 1.3: DUPLICATE DIAGNOSIS ([{store_col}], [{code_col}]) ---")
    print("=======================================================")
    
    dup_query = f"""
    SELECT TOP 10 [{store_col}], [{code_col}], COUNT(*) as cnt
    FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING
    GROUP BY [{store_col}], [{code_col}]
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    """
    try:
        cursor.execute(dup_query)
        dup_groups = cursor.fetchall()
        print(f"Found duplicate (store, code) groups count: {len(dup_groups)}")
        results['duplicate_groups'] = [{"store": str(r[0]), "code": str(r[1]), "count": r[2]} for r in dup_groups]
        for g in dup_groups:
            print(f"  Store: {g[0]}, Code: {g[1]} -> Count: {g[2]}")

        dup_samples = []
        for g in dup_groups[:3]:
            st, cd = str(g[0]), str(g[1])
            print(f"\n--- Detailed rows for Duplicate Group (Store='{st}', Code='{cd}') ---")
            detail_query = f"SELECT * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WHERE [{store_col}] = ? AND [{code_col}] = ?"
            cursor.execute(detail_query, (st, cd))
            d_rows = cursor.fetchall()
            d_dicts = []
            for r in d_rows:
                r_dict = {col_name: (str(val) if val is not None else None) for col_name, val in zip(col_names, r)}
                d_dicts.append(r_dict)
            dup_samples.append({"store": st, "code": cd, "rows": d_dicts})
            
            # Find which columns differ between duplicate rows
            diff_cols = []
            if len(d_dicts) > 1:
                for col in col_names:
                    vals = set(r[col] for r in d_dicts)
                    if len(vals) > 1:
                        diff_cols.append((col, list(vals)))
            print(f"Columns that DIFFER between duplicate rows for Store='{st}', Code='{cd}':")
            for dc, vals in diff_cols:
                print(f"   -> [{dc}]: {vals}")
        
        results['duplicate_sample_details'] = dup_samples
    except Exception as e:
        print("Duplicate diagnosis query error:", e)
        results['duplicate_query_error'] = str(e)

    print("\n=======================================================")
    print("--- FAZA 2.1: fnc_TS_SALES_REPORT_FOR_PLANNING INSPECTION ---")
    print("=======================================================")
    
    # 1. Object metadata
    func_meta_query = """
    SELECT object_id, type, type_desc, create_date, modify_date
    FROM sys.objects
    WHERE name = 'fnc_TS_SALES_REPORT_FOR_PLANNING'
    """
    cursor.execute(func_meta_query)
    meta_row = cursor.fetchone()
    if meta_row:
        obj_id, obj_type, type_desc, cdate, mdate = meta_row
        print(f"Function Metadata:")
        print(f"  Object ID: {obj_id}")
        print(f"  Type Code: {obj_type} ({type_desc})")
        print(f"  Created Date: {cdate}")
        print(f"  Modified Date: {mdate}")
        results['function_metadata'] = {
            "object_id": obj_id, "type": obj_type, "type_desc": type_desc,
            "create_date": str(cdate), "modify_date": str(mdate)
        }
    else:
        print("WARNING: Function 'fnc_TS_SALES_REPORT_FOR_PLANNING' not found in sys.objects!")

    # 2. Parameters query
    param_query = """
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
    """
    cursor.execute(param_query)
    params = cursor.fetchall()
    param_list = [
        {
            "param_name": r[0], "parameter_id": r[1], "data_type": r[2],
            "max_length": r[3], "precision": r[4], "scale": r[5], "is_output": r[6]
        }
        for r in params
    ]
    results['function_parameters'] = param_list
    print(f"Parameters Count: {len(param_list)}")
    for p in param_list:
        print(f"  Param #{p['parameter_id']}: {p['param_name']} ({p['data_type']}) - Output: {p['is_output']}")

    print("\n=======================================================")
    print("--- FAZA 2.2: fnc_TS_SALES_REPORT_FOR_PLANNING CALL & SAMPLE DATA ---")
    print("=======================================================")
    
    sales_test_query = "SELECT TOP 20 * FROM fnc_TS_SALES_REPORT_FOR_PLANNING('2026-09-03', '2026-09-07')"
    print(f"Executing Query: {sales_test_query}")
    try:
        cursor.execute(sales_test_query)
        sales_col_names = [c[0] for c in cursor.description]
        sales_rows = cursor.fetchall()
        sales_sample = []
        for r in sales_rows:
            r_dict = {col_name: (str(val) if val is not None else None) for col_name, val in zip(sales_col_names, r)}
            sales_sample.append(r_dict)
            
        results['sales_function_columns'] = sales_col_names
        results['sales_function_sample_rows'] = sales_sample
        
        print(f"\nFunction returned {len(sales_sample)} sample rows.")
        print(f"Sales Function Columns ({len(sales_col_names)}):")
        for idx, sc in enumerate(sales_col_names, 1):
            print(f"  {idx:2d}. {sc}")
            
        if sales_sample:
            print("\nFirst Sales Sample Row:")
            for k, v in list(sales_sample[0].items())[:15]:
                print(f"  {k}: {v}")

        # Column mapping candidates for sales function
        sales_store_col = [c for c in sales_col_names if 'IS YERI' in c.upper() or 'MAGAZA' in c.upper() or 'STORE' in c.upper() or 'ANBAR' in c.upper()]
        sales_code_col = [c for c in sales_col_names if 'URUN KOD' in c.upper() or 'ITEM_CODE' in c.upper() or 'MEHSUL_KOD' in c.upper() or 'BARKOD' in c.upper() or 'CODE' in c.upper()]
        sales_qty_col = [c for c in sales_col_names if 'SATIS' in c.upper() or 'SALE' in c.upper() or 'MIQTAR' in c.upper() or 'QTY' in c.upper() or 'ADET' in c.upper() or 'TUTAR' in c.upper()]

        print("\nSales Function Mapping Candidates:")
        print("  Store candidates:", sales_store_col)
        print("  Code candidates: ", sales_code_col)
        print("  Sales Quantity candidates:", sales_qty_col)

    except Exception as e:
        print("Error calling sales function:", e)
        results['sales_function_error'] = str(e)

    # Save output to json file
    output_json_path = os.path.join(backend_dir, 'faza1_output.json')
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n✅ FAZA 1 Investigation Complete! Results saved to {output_json_path}")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
