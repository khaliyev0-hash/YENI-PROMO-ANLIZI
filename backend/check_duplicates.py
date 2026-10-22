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

    print("--- Checking duplicates in vw_TS_ITEMS_DETAIL_FOR_PLANNING ---")
    cursor.execute("""
    SELECT TOP 10 [IS YERI NO], [URUN KODU], COUNT(*) as cnt
    FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK)
    GROUP BY [IS YERI NO], [URUN KODU]
    HAVING COUNT(*) > 1
    """)
    dups1 = cursor.fetchall()
    print(f"vw_TS_ITEMS_DETAIL_FOR_PLANNING duplicate count: {len(dups1)}")
    for d in dups1:
        print(f"  Store: {d[0]}, Code: {d[1]} -> Count: {d[2]}")

    if dups1:
        st, cd = str(dups1[0][0]), str(dups1[0][1])
        cursor.execute("SELECT * FROM vw_TS_ITEMS_DETAIL_FOR_PLANNING WITH (NOLOCK) WHERE [IS YERI NO] = ? AND [URUN KODU] = ?", (st, cd))
        c_names = [c[0] for c in cursor.description]
        rows = cursor.fetchall()
        print(f"\nSample duplicate rows for Store='{st}', Code='{cd}':")
        for r in rows:
            print("  ", {c_names[i]: r[i] for i in range(len(c_names)) if r[i] is not None})

    print("\n--- Checking duplicates in vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING ---")
    cursor.execute("""
    SELECT TOP 10 [IS YERI NO], [URUN KODU], COUNT(*) as cnt
    FROM vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING WITH (NOLOCK)
    GROUP BY [IS YERI NO], [URUN KODU]
    HAVING COUNT(*) > 1
    """)
    dups2 = cursor.fetchall()
    print(f"vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING duplicate count: {len(dups2)}")
    for d in dups2:
        print(f"  Store: {d[0]}, Code: {d[1]} -> Count: {d[2]}")

    if dups2:
        st, cd = str(dups2[0][0]), str(dups2[0][1])
        cursor.execute("SELECT * FROM vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING WITH (NOLOCK) WHERE [IS YERI NO] = ? AND [URUN KODU] = ?", (st, cd))
        c_names = [c[0] for c in cursor.description]
        rows = cursor.fetchall()
        print(f"\nSample duplicate rows for Store='{st}', Code='{cd}':")
        for r in rows:
            print("  ", {c_names[i]: r[i] for i in range(len(c_names)) if r[i] is not None})

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
