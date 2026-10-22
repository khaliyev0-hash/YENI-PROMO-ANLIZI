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
    conn = pyodbc.connect(conn_str, timeout=10)
    cursor = conn.cursor()
    
    results = {}

    print("=======================================================")
    print("--- 1. SCHEMA COLUMNS FOR PLANNING & STOCK VIEWS ---")
    print("=======================================================")
    views = [
        'vw_TS_ITEMS_DETAIL_FOR_PLANNING',
        'vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING',
        'VW_STOCK_ANALYSIS_DAILY_14DAYS',
        'VW_TS_DEPO_STOCK_ANALIZI',
        'vw_TS_YOLDAKI_ANBAR_QALIGI_FOR_PLANNING',
        'vw_TS_TOTAL_MAGAZASATISLAR'
    ]

    for v in views:
        cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
        """, (v,))
        cols = cursor.fetchall()
        col_list = [{"name": c[0], "type": c[1], "len": c[2], "nullable": c[3]} for c in cols]
        results[v] = col_list
        print(f"\nView [{v}] ({len(col_list)} columns):")
        for c in col_list:
            print(f"  - {c['name']} ({c['type']})")

    print("\n=======================================================")
    print("--- 2. DUPLICATE CHECK FOR SPECIFIC STORE & CODES ---")
    print("=======================================================")
    # Pick a specific IS YERI NO and check if there are duplicates
    cursor.execute("""
    SELECT TOP 10 [IS YERI NO], [URUN KODU]
    FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)
    """)
    sample_pairs = cursor.fetchall()
    print("Sample (IS YERI NO, URUN KODU) pairs:")
    for p in sample_pairs:
        print(f"  Store: '{p[0]}', Code: '{p[1]}'")

    # Check for duplicates of first store
    test_store = sample_pairs[0][0] if sample_pairs else '111'
    print(f"\nChecking duplicate count for IS YERI NO='{test_store}'...")
    cursor.execute("""
    SELECT [IS YERI NO], [URUN KODU], COUNT(*) as cnt
    FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)
    WHERE [IS YERI NO] = ?
    GROUP BY [IS YERI NO], [URUN KODU]
    HAVING COUNT(*) > 1
    """, (test_store,))
    dup_in_store = cursor.fetchall()
    print(f"Duplicate pairs found in IS YERI NO='{test_store}': {len(dup_in_store)}")
    for d in dup_in_store[:5]:
        print(f"  Store: {d[0]}, Code: {d[1]} -> Count: {d[2]}")

    dup_sample_rows = []
    if dup_in_store:
        st, cd = str(dup_in_store[0][0]), str(dup_in_store[0][1])
        print(f"\n--- Detailed rows for Duplicate Group (Store='{st}', Code='{cd}') ---")
        cursor.execute("SELECT * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK) WHERE [IS YERI NO] = ? AND [URUN KODU] = ?", (st, cd))
        col_names = [c[0] for c in cursor.description]
        d_rows = cursor.fetchall()
        for r in d_rows:
            r_dict = {col_names[i]: (str(r[i]) if r[i] is not None else None) for i in range(len(col_names))}
            dup_sample_rows.append(r_dict)
        print(f"Found {len(dup_sample_rows)} rows for Store='{st}', Code='{cd}'.")
        
        diff_cols = {}
        for col in col_names:
            vals = set(r[col] for r in dup_sample_rows)
            if len(vals) > 1:
                diff_cols[col] = list(vals)
        print("Columns that DIFFER between duplicate rows:")
        for col, vals in diff_cols.items():
            print(f"  - [{col}]: {vals}")

    results['duplicate_in_store_sample'] = {
        "store": test_store,
        "duplicate_count": len(dup_in_store),
        "dup_pairs": [{"store": str(d[0]), "code": str(d[1]), "count": d[2]} for d in dup_in_store[:5]],
        "sample_rows": dup_sample_rows
    }

    with open(os.path.join(backend_dir, 'faza1_schema_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n✅ FAZA 1 Schema Investigation Complete! Saved to backend/faza1_schema_summary.json")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
