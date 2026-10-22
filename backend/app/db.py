import os
import pyodbc
import pandas as pd
from typing import Optional, Dict, Any, Tuple, List, Set
from datetime import datetime, timedelta
from app.config import get_store_filter_config, normalize_rule_token


def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip()

load_env()

DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
DB_SERVER = os.getenv("DB_SERVER", "cltmdb03")
DB_NAME = os.getenv("DB_NAME", "Ltamstore")
DB_UID = os.getenv("DB_UID", "lgn_planning")
DB_PWD = os.getenv("DB_PWD", "l@n_pl@n!ng202%")

PARQUET_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "parquet_cache")
STOCK_PARQUET = os.path.join(PARQUET_DIR, "stock_snapshot.parquet")
SALES_PARQUET = os.path.join(PARQUET_DIR, "sales_snapshot.parquet")

from contextlib import contextmanager

def get_db_connection():
    available = pyodbc.drivers()
    preferred = [DB_DRIVER, "SQL Server", "SQL Server Native Client 11.0", "ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"]
    drivers = [d for d in preferred if d in available]
    if not drivers:
        drivers = available
    last_error = None
    for driver in drivers:
        try:
            conn_str = f"DRIVER={{{driver}}};SERVER={DB_SERVER};DATABASE={DB_NAME};UID={DB_UID};PWD={DB_PWD};"
            conn = pyodbc.connect(conn_str, timeout=5)
            return conn
        except Exception as e:
            last_error = e
            continue
    raise RuntimeError(f"Database connection failed: {last_error}")

@contextmanager
def db_connection_scope():
    conn = get_db_connection()
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception:
            pass

def normalize_store_code(code: Any) -> Optional[str]:
    """
    Normalizes store codes from Excel:
    'ST-101' -> '101', 'ST-005' -> '5', '101' -> '101', '000101' -> '101'
    Returns cleaned string format of the store number, or None if invalid.
    """
    if code is None or pd.isnull(code):
        return None
    s = str(code).strip().upper()
    if not s or s in ['NONE', 'NAN', 'NULL']:
        return None
    if s.startswith('ST-'):
        s = s[3:]
    elif s.startswith('ST'):
        s = s[2:]
    s = s.lstrip('0')
    return s if s else '0'

def normalize_item_code(code: Any) -> Optional[str]:
    """
    Normalizes item/SKU codes: strips leading/trailing spaces and empty values.
    """
    if code is None or pd.isnull(code):
        return None
    c = str(code).strip()
    if not c or c.lower() in ['none', 'nan', 'null']:
        return None
    return c

def get_active_store_codes(
    status_include: Optional[List[str]] = None,
    type_exclude: Optional[List[str]] = None,
    custom_df: Optional[pd.DataFrame] = None
) -> Tuple[Set[str], Dict[str, Any]]:
    """
    Single source of truth:
    Fetches the market details view vw_TS_MARKET_DETAILS once per processing run,
    normalizes store codes, statuses, and types, and returns:
    (active_store_codes_set, breakdown_dict).
    
    Rules:
    - keep only stores where [MAGAZA STATUSU] is in status_include (default: STORE_STATUS_INCLUDE in .env, 'AKTIV')
    - exclude stores where [TIP] is in type_exclude (default: STORE_TYPE_EXCLUDE in .env, 'BLANK', 'MINI', 'REGION MINI')
    - NULL/empty [TIP] is NOT excluded (only literal excluded values are); counted in null_type_kept
    - If a store has duplicate rows: it is active only if its rows agree on status and type;
      if they conflict, treat as NOT active and list those stores in dropped_conflicting.
    - Fail closed: if the query fails, or the active set is empty, raises RuntimeError.
      Never falls back silently to all stores.
    """
    default_status_inc, default_type_exc = get_store_filter_config()
    target_status_inc = (
        [normalize_rule_token(s) for s in status_include if s and str(s).strip()]
        if status_include is not None
        else default_status_inc
    )
    target_type_exc = (
        [normalize_rule_token(t) for t in type_exclude if t and str(t).strip()]
        if type_exclude is not None
        else default_type_exc
    )

    if custom_df is not None:
        df_view = custom_df.copy()
    else:
        try:
            with db_connection_scope() as conn:
                cursor = conn.cursor()
                query = """
                    SELECT 
                        CAST([MAGAZA KODU] AS VARCHAR(20)) AS store_code,
                        CAST([MAGAZA STATUSU] AS VARCHAR(50)) AS status,
                        CAST([TIP] AS VARCHAR(50)) AS tip,
                        CAST([MAGAZA] AS VARCHAR(100)) AS magaza_name
                    FROM vw_TS_MARKET_DETAILS
                """
                cursor.execute(query)
                col_names = [col[0].lower() for col in cursor.description]
                rows = cursor.fetchall()
                data = [dict(zip(col_names, row)) for row in rows]
                df_view = pd.DataFrame(data)
        except Exception as e:
            raise RuntimeError(f"vw_TS_MARKET_DETAILS mağaza cədvəlini oxumaq mümkün olmadı: {e}")

    # Standardize column names if needed
    col_map = {}
    for col in df_view.columns:
        norm_c = str(col).strip().upper()
        if norm_c in ["STORE_CODE", "MAGAZA KODU", "MAGAZA_KODU", "IS YERI NO", "IS_YERI_NO"]:
            col_map[col] = "store_code"
        elif norm_c in ["STATUS", "MAGAZA STATUSU", "MAGAZA_STATUSU"]:
            col_map[col] = "status"
        elif norm_c in ["TIP", "TYPE"]:
            col_map[col] = "tip"
        elif norm_c in ["MAGAZA", "MAGAZA_NAME", "STORE_NAME", "NAME"]:
            col_map[col] = "magaza_name"
    if col_map:
        df_view = df_view.rename(columns=col_map)

    if df_view.empty:
        raise RuntimeError("vw_TS_MARKET_DETAILS cədvəli boşdur (0 sətr tapıldı).")

    total_view_rows = len(df_view)

    grouped_stores: Dict[str, List[Dict[str, Any]]] = {}
    for _, row in df_view.iterrows():
        raw_code = row.get("store_code")
        norm_code = normalize_store_code(raw_code)
        if not norm_code:
            continue

        raw_status = row.get("status")
        status_norm = normalize_rule_token(raw_status)

        raw_tip = row.get("tip")
        if raw_tip is None or pd.isnull(raw_tip) or str(raw_tip).strip() == "" or str(raw_tip).strip().lower() in ['none', 'nan', 'null']:
            tip_norm = None
        else:
            tip_norm = normalize_rule_token(raw_tip)

        grouped_stores.setdefault(norm_code, []).append({
            "status_norm": status_norm,
            "tip_norm": tip_norm,
            "raw_status": raw_status,
            "raw_tip": raw_tip,
            "name": row.get("magaza_name")
        })

    total_distinct_stores = len(grouped_stores)

    kept: List[str] = []
    dropped_status: List[str] = []
    dropped_type: List[str] = []
    dropped_conflicting: List[str] = []
    null_type_kept: List[str] = []

    for code, rows in grouped_stores.items():
        statuses = set(r["status_norm"] for r in rows)
        tips = set(r["tip_norm"] for r in rows)

        if len(statuses) > 1 or len(tips) > 1:
            dropped_conflicting.append(code)
            continue

        st_val = rows[0]["status_norm"]
        tp_val = rows[0]["tip_norm"]

        if st_val not in target_status_inc:
            dropped_status.append(code)
        elif tp_val is not None and tp_val in target_type_exc:
            dropped_type.append(code)
        else:
            kept.append(code)
            if tp_val is None:
                null_type_kept.append(code)

    active_set = set(kept)
    if not active_set:
        raise RuntimeError(
            f"Aktiv mağaza tapılmadı: vw_TS_MARKET_DETAILS filtrindən sonra heç bir aktiv mağaza qalmadı "
            f"(Ümumi mağaza: {total_distinct_stores}, Kept: 0, Dropped Status: {len(dropped_status)}, "
            f"Dropped Type: {len(dropped_type)}, Conflicting: {len(dropped_conflicting)})."
        )

    breakdown = {
        "total_view_rows": total_view_rows,
        "total_distinct_stores": total_distinct_stores,
        "kept": sorted(kept),
        "dropped_status": sorted(dropped_status),
        "dropped_type": sorted(dropped_type),
        "dropped_conflicting": sorted(dropped_conflicting),
        "null_type_kept": sorted(null_type_kept)
    }

    return active_set, breakdown

def fetch_promo_sales_and_stock(
    beg_date: str, 
    end_date: str,
    item_codes: Optional[List[str]] = None,
    store_codes: Optional[List[str]] = None
) -> pd.DataFrame:
    """
    High-Performance Parquet Cache Reader:
    Fetches promo sales, item master metadata, and store stock snapshot directly from
    pre-computed pyarrow/snappy compressed Parquet cache files.
    
    If Parquet cache files do not exist, raises a clear RuntimeError:
    "Keş datası tapılmadı, əvvəlcə export_to_parquet.py skriptini işə salın"
    """
    if not (os.path.exists(STOCK_PARQUET) and os.path.exists(SALES_PARQUET)):
        raise RuntimeError("Keş datası tapılmadı, əvvəlcə export_to_parquet.py skriptini işə salın")
        
    clean_item_codes = list(set(normalize_item_code(c) for c in (item_codes or []) if normalize_item_code(c)))
    norm_stores = list(set(normalize_store_code(s) for s in (store_codes or []) if normalize_store_code(s)))
    
    # 1. Read Sales Snapshot using pyarrow filters (item_code, store_code, sale_date)
    sales_filters = []
    if clean_item_codes:
        sales_filters.append(('item_code', 'in', clean_item_codes))
    if norm_stores:
        sales_filters.append(('store_code', 'in', norm_stores))
    if beg_date:
        sales_filters.append(('sale_date', '>=', beg_date))
    if end_date:
        sales_filters.append(('sale_date', '<=', end_date))
        
    try:
        if sales_filters:
            sales_df = pd.read_parquet(SALES_PARQUET, engine='pyarrow', filters=sales_filters)
        else:
            sales_df = pd.read_parquet(SALES_PARQUET, engine='pyarrow')
    except Exception as e:
        print(f"Error reading sales parquet cache with filters: {e}")
        sales_df = pd.read_parquet(SALES_PARQUET, engine='pyarrow')
        
    # In-memory date fallback if needed
    if not sales_df.empty and 'sale_date' in sales_df.columns:
        date_mask = (sales_df['sale_date'] >= beg_date) & (sales_df['sale_date'] <= end_date)
        sales_df = sales_df[date_mask]
        
    if sales_df.empty:
        return pd.DataFrame(columns=[
            'sale_date', 'store_code', 'item_code', 'item_name', 'family_name', 
            'category_name', 'sub_category_name', 'supplier_name', 'barcode', 
            'sales_price', 'purchase_price', 'sales_qty', 'sales_amount', 'current_stock'
        ])
        
    # 2. Read Stock & Item Master Snapshot
    stock_filters = []
    if clean_item_codes:
        stock_filters.append(('item_code', 'in', clean_item_codes))
    if norm_stores:
        stock_filters.append(('store_code', 'in', norm_stores))
        
    try:
        if stock_filters:
            stock_df = pd.read_parquet(STOCK_PARQUET, engine='pyarrow', filters=stock_filters)
        else:
            stock_df = pd.read_parquet(STOCK_PARQUET, engine='pyarrow')
    except Exception as e:
        print(f"Error reading stock parquet cache with filters: {e}")
        stock_df = pd.read_parquet(STOCK_PARQUET, engine='pyarrow')

    # Aggregate Sales by date, store_code, item_code
    aggregated_sales = sales_df.groupby(['sale_date', 'store_code', 'item_code'], as_index=False).agg({
        'sales_qty': 'sum',
        'sales_amount': 'sum'
    })

    # Merge stock_df with aggregated sales using outer join on (store_code, item_code)
    # so that items with stock but no sales in the date range are NOT excluded!
    merged = pd.merge(
        stock_df,
        aggregated_sales,
        on=['store_code', 'item_code'],
        how='outer'
    )
    
    # Ensure expected columns are present with appropriate fallbacks
    merged['sale_date'] = merged['sale_date'].fillna(beg_date)
    merged['item_name'] = merged['item_name'].fillna(merged['item_code'])
    merged['family_name'] = merged['family_name'].fillna("Baqaliyya & Ərzaq")
    merged['category_name'] = merged['category_name'].fillna("Ümumi Məhsullar")
    merged['sub_category_name'] = merged['sub_category_name'].fillna("Ümumi")
    merged['supplier_name'] = merged['supplier_name'].fillna("Bilməyən Təchizatçı")
    merged['barcode'] = merged['barcode'].fillna("")
    merged['sales_price'] = merged['sales_price'].fillna(0.0)
    merged['purchase_price'] = merged['purchase_price'].fillna(0.0)
    merged['sales_qty'] = merged['sales_qty'].fillna(0.0)
    merged['sales_amount'] = merged['sales_amount'].fillna(0.0)
    merged['stock_qty'] = merged['stock_qty'].fillna(0.0)
    merged = merged.rename(columns={'stock_qty': 'current_stock'})
    
    # Return columns in standard order
    expected_cols = [
        'sale_date', 'store_code', 'item_code', 'item_name', 'family_name', 
        'category_name', 'sub_category_name', 'supplier_name', 'barcode', 
        'sales_price', 'purchase_price', 'sales_qty', 'sales_amount', 'current_stock'
    ]
    for col in expected_cols:
        if col not in merged.columns:
            merged[col] = 0.0 if 'qty' in col or 'amount' in col or 'stock' in col or 'price' in col else ""
            
    return merged[expected_cols]

_STORE_STOCK_CACHE: Dict[Tuple[str, Tuple[str, ...]], Dict[Tuple[str, str], float]] = {}
_CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "store_stock_cache.json")

def _load_disk_stock_cache():
    global _STORE_STOCK_CACHE
    if os.path.exists(_CACHE_FILE):
        try:
            import json
            with open(_CACHE_FILE, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                for entry in raw_data:
                    st = entry["store"]
                    dts = tuple(entry["dates"])
                    items = {}
                    for k, v in entry["items"].items():
                        # key format: "item||date"
                        parts = k.split("||", 1)
                        if len(parts) == 2:
                            items[(parts[0], parts[1])] = float(v)
                    _STORE_STOCK_CACHE[(st, dts)] = items
        except Exception as e:
            print(f"Warning: could not load store stock disk cache: {e}")

_load_disk_stock_cache()

def _save_disk_stock_cache():
    try:
        import json
        out_list = []
        for (st, dts), items in _STORE_STOCK_CACHE.items():
            str_items = {f"{it}||{dt}": val for (it, dt), val in items.items()}
            out_list.append({"store": st, "dates": list(dts), "items": str_items})
        with open(_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(out_list, f, ensure_ascii=False)
    except Exception as e:
        print(f"Warning: could not save store stock disk cache: {e}")

def get_store_historical_stocks(store_code: str, past_dates: List[str]) -> Dict[Tuple[str, str], float]:
    """
    Fetches daily stock history per item for a specific store from fnc_TS_STOK_DATE_PLANNING.
    Uses parallel queries, disk persistence, and in-memory caching to ensure instant responses.
    Capped at 2026-10-16 since DB function has snapshots only up to that date.
    """
    from concurrent.futures import ThreadPoolExecutor
    norm_st = normalize_store_code(store_code) or store_code
    valid_past_dates = sorted([d for d in past_dates if d <= '2026-10-16'])
    if not valid_past_dates:
        return {}

    cache_key = (norm_st, tuple(valid_past_dates))
    if cache_key in _STORE_STOCK_CACHE:
        return _STORE_STOCK_CACHE[cache_key]

    # Also check if any existing cached entry for this store covers all valid_past_dates
    for (c_st, c_dts), c_items in _STORE_STOCK_CACHE.items():
        if c_st == norm_st and set(valid_past_dates).issubset(set(c_dts)):
            subset_res = {k: v for k, v in c_items.items() if k[1] in valid_past_dates}
            _STORE_STOCK_CACHE[cache_key] = subset_res
            return subset_res

    result: Dict[Tuple[str, str], float] = {}

    def fetch_date(d: str):
        date_res = {}
        try:
            with db_connection_scope() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT CODE, STOK
                    FROM fnc_TS_STOK_DATE_PLANNING(?)
                    WHERE INVENNO = ?
                ''', (d, norm_st))
                for row in cursor.fetchall():
                    if row[0] is not None:
                        cd_norm = normalize_item_code(row[0]) or str(row[0]).strip()
                        stk_val = float(row[1]) if row[1] is not None else 0.0
                        date_res[(cd_norm, d)] = stk_val
        except Exception as e:
            print(f"Warning: Could not fetch DB stock history for date {d}, store {store_code}: {e}")
        return date_res

    try:
        workers = min(len(valid_past_dates), 6) if valid_past_dates else 1
        with ThreadPoolExecutor(max_workers=workers) as executor:
            date_results = list(executor.map(fetch_date, valid_past_dates))
            for dr in date_results:
                result.update(dr)
    except Exception as e:
        print(f"Warning: Could not fetch DB stock history for store {store_code}: {e}")

    _STORE_STOCK_CACHE[cache_key] = result
    if result:
        _save_disk_stock_cache()
    return result

_REGULAR_SALES_30D_CACHE: Dict[Tuple[str, str, Tuple[str, ...], Tuple[str, ...]], Dict[Tuple[str, str], float]] = {}
_REG_SALES_CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "regular_sales_cache.json")

def _load_disk_regular_sales_cache():
    global _REGULAR_SALES_30D_CACHE
    if os.path.exists(_REG_SALES_CACHE_FILE):
        try:
            import json
            with open(_REG_SALES_CACHE_FILE, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                for entry in raw_data:
                    bd = entry["beg_date"]
                    ed = entry["end_date"]
                    sts = tuple(entry["stores"])
                    its = tuple(entry["items"])
                    items_dict = {}
                    for k, v in entry["data"].items():
                        parts = k.split("||", 1)
                        if len(parts) == 2:
                            items_dict[(parts[0], parts[1])] = float(v)
                    _REGULAR_SALES_30D_CACHE[(bd, ed, sts, its)] = items_dict
        except Exception as e:
            print(f"Warning: could not load regular sales disk cache: {e}")

_load_disk_regular_sales_cache()

def _save_disk_regular_sales_cache():
    try:
        import json
        out_list = []
        for (bd, ed, sts, its), data in _REGULAR_SALES_30D_CACHE.items():
            str_data = {f"{st}||{it}": val for (st, it), val in data.items()}
            out_list.append({
                "beg_date": bd,
                "end_date": ed,
                "stores": list(sts),
                "items": list(its),
                "data": str_data
            })
        with open(_REG_SALES_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(out_list, f, ensure_ascii=False)
    except Exception as e:
        print(f"Warning: could not save regular sales disk cache: {e}")

def fetch_regular_sales_30d(
    store_codes: Optional[List[str]] = None,
    item_codes: Optional[List[str]] = None,
    end_date: Optional[str] = None
) -> Dict[Tuple[str, str], float]:
    """
    Fetches regular 30-day sales (SUM(MIQDARI) - SUM(INSERT_MIQDARI)) for given stores & items.
    Window is [end_date - 29 days, end_date].
    Returns dict mapping (normalized_store_code, normalized_item_code) -> regular_30d.
    Uses disk cache and parquet cache for sub-second responses.
    """
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    else:
        end_date = str(end_date)[:10]

    try:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except Exception:
        end_dt = datetime.now()
        end_date = end_dt.strftime("%Y-%m-%d")

    beg_dt = end_dt - timedelta(days=29)
    beg_date = beg_dt.strftime("%Y-%m-%d")

    norm_stores = sorted(list(set(normalize_store_code(s) for s in (store_codes or []) if normalize_store_code(s))))
    clean_items = sorted(list(set(normalize_item_code(i) for i in (item_codes or []) if normalize_item_code(i))))

    cache_key = (beg_date, end_date, tuple(norm_stores), tuple(clean_items))
    if cache_key in _REGULAR_SALES_30D_CACHE:
        return _REGULAR_SALES_30D_CACHE[cache_key]

    # Check if any cached entry matches this store and date range
    for (c_bd, c_ed, c_sts, _), c_data in _REGULAR_SALES_30D_CACHE.items():
        if c_bd == beg_date and c_ed == end_date and set(norm_stores).issubset(set(c_sts)):
            if clean_items:
                matched = {k: v for k, v in c_data.items() if k[0] in norm_stores and k[1] in clean_items}
            else:
                matched = {k: v for k, v in c_data.items() if k[0] in norm_stores}
            if matched:
                _REGULAR_SALES_30D_CACHE[cache_key] = matched
                return matched

    result: Dict[Tuple[str, str], float] = {}

    # Prefer ultra-fast local Parquet cache (sub-second)
    if os.path.exists(SALES_PARQUET):
        try:
            p_filters = [('sale_date', '>=', beg_date), ('sale_date', '<=', end_date)]
            if norm_stores:
                p_filters.append(('store_code', 'in', norm_stores))
            if clean_items:
                p_filters.append(('item_code', 'in', clean_items))
            df_p = pd.read_parquet(SALES_PARQUET, engine='pyarrow', filters=p_filters)
            if not df_p.empty:
                grp = df_p.groupby(['store_code', 'item_code'])['sales_qty'].sum().reset_index()
                for _, r in grp.iterrows():
                    st_norm = normalize_store_code(r['store_code'])
                    it_norm = normalize_item_code(r['item_code'])
                    if st_norm and it_norm:
                        result[(st_norm, it_norm)] = max(0.0, round(float(r['sales_qty']), 2))
                _REGULAR_SALES_30D_CACHE[cache_key] = result
                _save_disk_regular_sales_cache()
                return result
        except Exception as pe:
            print(f"Notice: Parquet read in fetch_regular_sales_30d: {pe}; falling back to DB.")

    where_clauses = []
    params = [beg_date, end_date]

    if norm_stores:
        store_params = []
        for s in norm_stores:
            store_params.append(s)
            if s.isdigit():
                store_params.append(int(s))
        store_placeholders = ",".join(["?"] * len(store_params))
        where_clauses.append(f"MAGAZA IN ({store_placeholders})")
        params.extend(store_params)

    if clean_items:
        item_placeholders = ",".join(["?"] * len(clean_items))
        where_clauses.append(f"MEHSUL_KODU IN ({item_placeholders})")
        params.extend(clean_items)

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    query = f"""
        SELECT 
            CAST(MAGAZA AS VARCHAR(50)) AS store_code,
            CAST(MEHSUL_KODU AS VARCHAR(50)) AS item_code,
            SUM(CAST(MIQDARI AS FLOAT)) AS qty_total,
            SUM(CAST(INSERT_MIQDARI AS FLOAT)) AS qty_insert
        FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING(?, ?)
        {where_str}
        GROUP BY MAGAZA, MEHSUL_KODU
    """

    try:
        with db_connection_scope() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            for row in cursor.fetchall():
                raw_st, raw_item, qty_tot, qty_ins = row
                st_norm = normalize_store_code(raw_st)
                item_norm = normalize_item_code(raw_item)
                if st_norm and item_norm:
                    tot_flt = float(qty_tot) if qty_tot is not None else 0.0
                    ins_flt = float(qty_ins) if qty_ins is not None else 0.0
                    reg_30d = max(0.0, round(tot_flt - ins_flt, 2))
                    result[(st_norm, item_norm)] = reg_30d
    except Exception as e:
        print(f"Warning: DB query in fetch_regular_sales_30d failed: {e}")

    _REGULAR_SALES_30D_CACHE[cache_key] = result
    if result:
        _save_disk_regular_sales_cache()
    return result


