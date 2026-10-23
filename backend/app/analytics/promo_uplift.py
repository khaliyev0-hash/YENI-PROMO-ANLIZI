import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple
import pandas as pd
import numpy as np

from app.db import (
    get_db_connection,
    db_connection_scope,
    normalize_item_code,
    normalize_store_code,
    get_active_store_codes,
    SALES_PARQUET
)

logger = logging.getLogger(__name__)

# In-memory caches to make repeated requests instantaneous
_UPLIFT_PRE_PROMO_CACHE: Dict[Tuple[str, str, Tuple[str, ...], Tuple[str, ...]], Dict[str, float]] = {}
_UPLIFT_LAST_DAY_CACHE: Dict[Tuple[str, Tuple[str, ...], Tuple[str, ...]], Dict[str, float]] = {}


def fetch_pre_promo_14d_sales(
    beg_date: str,
    item_codes: List[str],
    store_codes: Optional[Set[str]] = None
) -> Tuple[Dict[str, float], str, str]:
    """
    Fetches 14-day regular normal sales prior to promo start date:
    Window: [beg_date - 14 days, beg_date - 1 day] inclusive.
    Returns: (dict mapping clean item_code -> normal_14d_sales_sum, pre_beg_date, pre_end_date)
    """
    try:
        beg_dt = datetime.strptime(str(beg_date)[:10], "%Y-%m-%d")
    except Exception:
        beg_dt = datetime.now()

    pre_end_dt = beg_dt - timedelta(days=1)
    pre_beg_dt = beg_dt - timedelta(days=14)
    pre_beg_str = pre_beg_dt.strftime("%Y-%m-%d")
    pre_end_str = pre_end_dt.strftime("%Y-%m-%d")

    clean_items = sorted(list(set(normalize_item_code(c) for c in item_codes if normalize_item_code(c))))
    clean_stores = tuple(sorted(list(str(s) for s in store_codes))) if store_codes else ()
    cache_key = (pre_beg_str, pre_end_str, tuple(clean_items), clean_stores)
    if cache_key in _UPLIFT_PRE_PROMO_CACHE:
        return _UPLIFT_PRE_PROMO_CACHE[cache_key], pre_beg_str, pre_end_str

    result: Dict[str, float] = {code: 0.0 for code in clean_items}

    # 1. Try Live MSSQL Database via fnc_TS_SALES_REPORT_FOR_PLANNING
    db_success = False
    try:
        where_clauses = ["MEHSUL_KODU IS NOT NULL"]
        params: List[Any] = [pre_beg_str, pre_end_str]

        if clean_items:
            placeholders = ",".join(["?"] * len(clean_items))
            where_clauses.append(f"MEHSUL_KODU IN ({placeholders})")
            params.extend(clean_items)

        if store_codes:
            store_params = []
            for s in store_codes:
                store_params.append(s)
                if s.isdigit():
                    store_params.append(int(s))
            s_placeholders = ",".join(["?"] * len(store_params))
            where_clauses.append(f"MAGAZA IN ({s_placeholders})")
            params.extend(store_params)

        where_str = " WHERE " + " AND ".join(where_clauses)
        query = f"""
            SELECT 
                CAST(MEHSUL_KODU AS VARCHAR(50)) AS item_code,
                SUM(CAST(MIQDARI AS FLOAT)) - SUM(CAST(INSERT_MIQDARI AS FLOAT)) AS normal_sales_qty
            FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING(?, ?)
            {where_str}
            GROUP BY MEHSUL_KODU
        """

        with db_connection_scope() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            for row in cursor.fetchall():
                raw_code, qty = row
                c_norm = normalize_item_code(raw_code)
                if c_norm and c_norm in result:
                    val = float(qty) if qty is not None else 0.0
                    result[c_norm] = max(0.0, round(val, 2))
        db_success = True
    except Exception as e:
        logger.warning("Pre-promo 14d DB query failed (%s), attempting Parquet fallback", e)

    # 2. Fallback to sales_snapshot.parquet
    if not db_success and os.path.exists(SALES_PARQUET) and clean_items:
        try:
            import pyarrow.parquet as pq
            filters = [
                ('sale_date', '>=', pre_beg_str),
                ('sale_date', '<=', pre_end_str),
                ('item_code', 'in', clean_items)
            ]
            tbl = pq.read_table(SALES_PARQUET, columns=['store_code', 'item_code', 'sales_qty'], filters=filters)
            if tbl.num_rows > 0:
                p_df = tbl.to_pandas()
                if store_codes:
                    p_df['_st'] = p_df['store_code'].astype(str).map(lambda s: normalize_store_code(s) or s)
                    p_df = p_df[p_df['_st'].isin(store_codes)]
                p_df['_it'] = p_df['item_code'].astype(str).map(lambda c: normalize_item_code(c) or c)
                agg = p_df.groupby('_it')['sales_qty'].sum()
                for c_norm, val in agg.items():
                    if c_norm in result:
                        result[c_norm] = max(0.0, round(float(val), 2))
        except Exception as p_err:
            logger.warning("Pre-promo 14d Parquet fallback error: %s", p_err)

    _UPLIFT_PRE_PROMO_CACHE[cache_key] = result
    return result, pre_beg_str, pre_end_str


def fetch_last_day_insert_sales(
    end_date: str,
    item_codes: List[str],
    store_codes: Optional[Set[str]] = None
) -> Dict[str, float]:
    """
    Fetches the insert sales on the final day of the promotion campaign (end_date).
    Returns dict mapping clean item_code -> last_day_promo_sales.
    """
    last_day_str = str(end_date)[:10]
    clean_items = sorted(list(set(normalize_item_code(c) for c in item_codes if normalize_item_code(c))))
    clean_stores = tuple(sorted(list(str(s) for s in store_codes))) if store_codes else ()
    cache_key = (last_day_str, tuple(clean_items), clean_stores)
    if cache_key in _UPLIFT_LAST_DAY_CACHE:
        return _UPLIFT_LAST_DAY_CACHE[cache_key]

    result: Dict[str, float] = {code: 0.0 for code in clean_items}

    # 1. Try Live MSSQL Database via fnc_TS_SALES_REPORT_FOR_PLANNING
    db_success = False
    try:
        where_clauses = ["MEHSUL_KODU IS NOT NULL"]
        params: List[Any] = [last_day_str, last_day_str]

        if clean_items:
            placeholders = ",".join(["?"] * len(clean_items))
            where_clauses.append(f"MEHSUL_KODU IN ({placeholders})")
            params.extend(clean_items)

        if store_codes:
            store_params = []
            for s in store_codes:
                store_params.append(s)
                if s.isdigit():
                    store_params.append(int(s))
            s_placeholders = ",".join(["?"] * len(store_params))
            where_clauses.append(f"MAGAZA IN ({s_placeholders})")
            params.extend(store_params)

        where_str = " WHERE " + " AND ".join(where_clauses)
        query = f"""
            SELECT 
                CAST(MEHSUL_KODU AS VARCHAR(50)) AS item_code,
                SUM(CAST(INSERT_MIQDARI AS FLOAT)) AS insert_sales_qty,
                SUM(CAST(MIQDARI AS FLOAT)) AS total_sales_qty
            FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING(?, ?)
            {where_str}
            GROUP BY MEHSUL_KODU
        """

        with db_connection_scope() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            for row in cursor.fetchall():
                raw_code, ins_qty, tot_qty = row
                c_norm = normalize_item_code(raw_code)
                if c_norm and c_norm in result:
                    val = float(ins_qty) if ins_qty is not None and float(ins_qty) > 0 else (float(tot_qty) if tot_qty is not None else 0.0)
                    result[c_norm] = max(0.0, round(val, 2))
        db_success = True
    except Exception as e:
        logger.warning("Last day promo sales DB query failed (%s), attempting Parquet fallback", e)

    # 2. Fallback to sales_snapshot.parquet
    if not db_success and os.path.exists(SALES_PARQUET) and clean_items:
        try:
            import pyarrow.parquet as pq
            filters = [
                ('sale_date', '==', last_day_str),
                ('item_code', 'in', clean_items)
            ]
            tbl = pq.read_table(SALES_PARQUET, columns=['store_code', 'item_code', 'sales_qty'], filters=filters)
            if tbl.num_rows > 0:
                p_df = tbl.to_pandas()
                if store_codes:
                    p_df['_st'] = p_df['store_code'].astype(str).map(lambda s: normalize_store_code(s) or s)
                    p_df = p_df[p_df['_st'].isin(store_codes)]
                p_df['_it'] = p_df['item_code'].astype(str).map(lambda c: normalize_item_code(c) or c)
                agg = p_df.groupby('_it')['sales_qty'].sum()
                for c_norm, val in agg.items():
                    if c_norm in result:
                        result[c_norm] = max(0.0, round(float(val), 2))
        except Exception as p_err:
            logger.warning("Last day promo sales Parquet fallback error: %s", p_err)

    _UPLIFT_LAST_DAY_CACHE[cache_key] = result
    return result


def compute_promo_uplift(
    fact_df: pd.DataFrame,
    beg_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_filter: Optional[str] = None,
    promo_type_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    search_query: Optional[str] = None,
    store_filter: Optional[str] = None,
    daily_sales_records: Optional[List[Dict[str, Any]]] = None,
    custom_baseline_map: Optional[Dict[str, float]] = None,
    custom_last_day_map: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Computes Promo Uplift analysis per SKU:
    Baseline: 14 days normal sales prior to promo start date.
    Promo Duration: (end_date - beg_date) + 1 days.
    Elapsed Sales Days: actual recorded sales days so far during the promo.
    Extrapolated Baseline: (normal_14d / 14) * elapsed_days (for like-for-like comparison).
    Incremental Sales (Uplift Qty): promo_sale - baseline.
    Uplift %: (promo_sale - baseline) / baseline * 100%.
    Latest Sales Day: promo sales recorded on the latest active day of the promotion.
    """
    if fact_df is None or fact_df.empty:
        return {
            "beg_date": beg_date or "",
            "end_date": end_date or "",
            "promo_days": 0,
            "elapsed_days": 0,
            "is_ongoing": False,
            "latest_sales_date": "",
            "pre_beg_date": "",
            "pre_end_date": "",
            "summary": {
                "total_skus": 0,
                "total_normal_14d": 0.0,
                "total_baseline": 0.0,
                "total_promo_sale": 0.0,
                "total_last_day_sale": 0.0,
                "total_uplift_qty": 0.0,
                "overall_uplift_pct": 0.0,
                "overall_uplift_ratio": None,
                "positive_uplift_count": 0,
                "negative_uplift_count": 0,
                "positive_uplift_share_pct": 0.0
            },
            "items": [],
            "categories": [],
            "families": []
        }

    # Normalize dates
    beg_date_clean = str(beg_date)[:10] if beg_date else "2026-10-15"
    end_date_clean = str(end_date)[:10] if end_date else "2026-10-28"

    try:
        b_dt = datetime.strptime(beg_date_clean, "%Y-%m-%d")
        e_dt = datetime.strptime(end_date_clean, "%Y-%m-%d")
        promo_days = max(1, (e_dt - b_dt).days + 1)
    except Exception:
        b_dt = datetime(2026, 10, 15)
        e_dt = datetime(2026, 10, 28)
        promo_days = 14

    # Determine elapsed days and latest sales date (for active / ongoing campaign support)
    elapsed_days = promo_days
    latest_sales_date = end_date_clean
    is_ongoing = False

    if daily_sales_records and isinstance(daily_sales_records, list):
        actual_days = [d for d in daily_sales_records if d.get('daily_sale') is not None and not d.get('is_future')]
        if actual_days:
            elapsed_days = len(actual_days)
            latest_sales_date = str(actual_days[-1].get('date', end_date_clean))[:10]
            if elapsed_days < promo_days:
                is_ongoing = True
    else:
        today_date = datetime.now().date()
        if today_date < b_dt.date():
            elapsed_days = 1
            latest_sales_date = beg_date_clean
            is_ongoing = True
        elif today_date <= e_dt.date():
            elapsed_days = min(promo_days, max(1, (today_date - b_dt.date()).days + 1))
            latest_sales_date = (b_dt + timedelta(days=elapsed_days - 1)).strftime("%Y-%m-%d")
            if elapsed_days < promo_days:
                is_ongoing = True
        else:
            elapsed_days = promo_days
            latest_sales_date = end_date_clean
            is_ongoing = False

    # Apply store filter if provided
    df = fact_df.copy()
    if store_filter and str(store_filter).strip() and str(store_filter).strip().upper() != 'ALL':
        clean_sf = normalize_store_code(str(store_filter).strip()) or str(store_filter).strip()
        df['_clean_store'] = df['STORE'].astype(str).map(lambda s: normalize_store_code(s) or s)
        df = df[df['_clean_store'] == clean_sf]
        active_stores = {clean_sf}
    else:
        # Get active stores safely with fallback
        try:
            active_stores, _ = get_active_store_codes()
        except Exception as e:
            logger.warning("Could not fetch active store codes: %s", e)
            active_stores = set(fact_df['STORE'].dropna().unique().tolist()) if 'STORE' in fact_df.columns else None

    # Normalize codes in fact_df
    df['_clean_code'] = df['CODE'].astype(str).str.strip().map(lambda c: normalize_item_code(c) or c)
    unique_items = df['_clean_code'].unique().tolist()

    # 1. Fetch 14-day normal sales map
    if custom_baseline_map is not None:
        normal_14d_map = custom_baseline_map
        pre_beg_str = (b_dt - timedelta(days=14)).strftime("%Y-%m-%d")
        pre_end_str = (b_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        normal_14d_map, pre_beg_str, pre_end_str = fetch_pre_promo_14d_sales(
            beg_date_clean, unique_items, store_codes=active_stores
        )

    # 2. Fetch latest active promo day sales map
    if custom_last_day_map is not None:
        last_day_map = custom_last_day_map
    else:
        last_day_map = fetch_last_day_insert_sales(
            latest_sales_date, unique_items, store_codes=active_stores
        )

    # 3. Aggregate fact_df at SKU level
    sku_groups = df.groupby('_clean_code')

    items: List[Dict[str, Any]] = []
    categories_set: Set[str] = set()
    families_set: Set[str] = set()

    for clean_code, group in sku_groups:
        # Product metadata
        name = str(group['NAME'].iloc[0]) if 'NAME' in group.columns and pd.notnull(group['NAME'].iloc[0]) else clean_code
        category = str(group['CATEGORY'].iloc[0]).strip() if 'CATEGORY' in group.columns and pd.notnull(group['CATEGORY'].iloc[0]) else "Təyin edilməyib"
        sub_category = str(group['SUB_CATEGORY'].iloc[0]).strip() if 'SUB_CATEGORY' in group.columns and pd.notnull(group['SUB_CATEGORY'].iloc[0]) else "Təyin edilməyib"
        family = str(group['FAMILY'].iloc[0]).strip() if 'FAMILY' in group.columns and pd.notnull(group['FAMILY'].iloc[0]) else "Təyin edilməyib"
        promo_type = str(group['PROMO_TYPE'].iloc[0]).strip().lower() if 'PROMO_TYPE' in group.columns and pd.notnull(group['PROMO_TYPE'].iloc[0]) else "adi"

        if category not in ["", "None", "nan"]:
            categories_set.add(category)
        if family not in ["", "None", "nan"]:
            families_set.add(family)

        store_count = int(group['STORE'].nunique()) if 'STORE' in group.columns else 1
        fc = float(pd.to_numeric(group['FC'], errors='coerce').fillna(0.0).sum()) if 'FC' in group.columns else 0.0
        promo_sale = float(pd.to_numeric(group['SALE'], errors='coerce').fillna(0.0).sum()) if 'SALE' in group.columns else 0.0
        stock = float(pd.to_numeric(group['FINAL_STOCK'], errors='coerce').fillna(0.0).sum()) if 'FINAL_STOCK' in group.columns else 0.0

        # Pre-promo 14d and Baseline calculations
        normal_14d = float(normal_14d_map.get(clean_code, 0.0))
        daily_baseline = round(normal_14d / 14.0, 2)
        baseline_sale = round(daily_baseline * elapsed_days, 2)
        full_baseline_sale = round(daily_baseline * promo_days, 2)

        # Last day sales
        last_day_sale = float(last_day_map.get(clean_code, 0.0))

        # Uplift calculations
        uplift_qty = round(promo_sale - baseline_sale, 2)

        if baseline_sale > 0:
            uplift_pct = round(((promo_sale - baseline_sale) / baseline_sale) * 100.0, 1)
            uplift_ratio = round(promo_sale / baseline_sale, 2)
        elif promo_sale > 0:
            uplift_pct = 100.0
            uplift_ratio = None
        else:
            uplift_pct = 0.0
            uplift_ratio = None

        # Status categorization
        if baseline_sale <= 0.0001:
            status = "NEW"
        elif uplift_pct >= 100.0:
            status = "HIGH"
        elif uplift_pct >= 20.0:
            status = "MODERATE"
        elif uplift_pct >= 0.0:
            status = "LOW"
        else:
            status = "NEGATIVE"

        items.append({
            "code": clean_code,
            "name": name,
            "category": category,
            "sub_category": sub_category,
            "family": family,
            "promo_type": promo_type,
            "store_count": store_count,
            "fc": round(fc, 1),
            "normal_14d_sale": round(normal_14d, 1),
            "daily_baseline": round(daily_baseline, 2),
            "baseline_sale": round(baseline_sale, 1),
            "full_baseline_sale": round(full_baseline_sale, 1),
            "promo_sale": round(promo_sale, 1),
            "last_day_sale": round(last_day_sale, 1),
            "uplift_qty": round(uplift_qty, 1),
            "uplift_pct": uplift_pct,
            "uplift_ratio": uplift_ratio,
            "status": status,
            "stock": round(stock, 1)
        })

    # Summary KPIs across ALL items before UI filters
    total_skus = len(items)
    tot_normal_14d = round(sum(r["normal_14d_sale"] for r in items), 1)
    tot_baseline = round(sum(r["baseline_sale"] for r in items), 1)
    tot_promo = round(sum(r["promo_sale"] for r in items), 1)
    tot_last_day = round(sum(r["last_day_sale"] for r in items), 1)
    tot_uplift_qty = round(tot_promo - tot_baseline, 1)

    if tot_baseline > 0:
        overall_uplift_pct = round(((tot_promo - tot_baseline) / tot_baseline) * 100.0, 1)
        overall_uplift_ratio = round(tot_promo / tot_baseline, 2)
    elif tot_promo > 0:
        overall_uplift_pct = 100.0
        overall_uplift_ratio = None
    else:
        overall_uplift_pct = 0.0
        overall_uplift_ratio = None

    pos_count = len([r for r in items if r["uplift_qty"] > 0])
    neg_count = len([r for r in items if r["uplift_qty"] < 0])
    pos_share = round((pos_count / total_skus) * 100.0, 1) if total_skus > 0 else 0.0

    summary = {
        "total_skus": total_skus,
        "total_normal_14d": tot_normal_14d,
        "total_baseline": tot_baseline,
        "total_promo_sale": tot_promo,
        "total_last_day_sale": tot_last_day,
        "total_uplift_qty": tot_uplift_qty,
        "overall_uplift_pct": overall_uplift_pct,
        "overall_uplift_ratio": overall_uplift_ratio,
        "positive_uplift_count": pos_count,
        "negative_uplift_count": neg_count,
        "positive_uplift_share_pct": pos_share
    }

    # Apply backend filters if requested
    filtered_items = items
    if category_filter and category_filter != "ALL":
        filtered_items = [r for r in filtered_items if r["category"] == category_filter]

    if promo_type_filter and promo_type_filter != "ALL":
        pt = promo_type_filter.lower()
        filtered_items = [r for r in filtered_items if pt in r["promo_type"].lower()]

    if status_filter and status_filter != "ALL":
        if status_filter == "POSITIVE":
            filtered_items = [r for r in filtered_items if r["uplift_qty"] > 0]
        else:
            filtered_items = [r for r in filtered_items if r["status"] == status_filter]

    if search_query and search_query.strip():
        q = search_query.strip().lower()
        filtered_items = [
            r for r in filtered_items
            if q in r["code"].lower() or q in r["name"].lower() or q in r["category"].lower()
        ]

    # Sorting
    filtered_items.sort(key=lambda x: (x["uplift_pct"] is None, x["uplift_pct"]), reverse=True)

    return {
        "beg_date": beg_date_clean,
        "end_date": end_date_clean,
        "promo_days": promo_days,
        "elapsed_days": elapsed_days,
        "is_ongoing": is_ongoing,
        "latest_sales_date": latest_sales_date,
        "pre_beg_date": pre_beg_str,
        "pre_end_date": pre_end_str,
        "summary": summary,
        "items": filtered_items,
        "categories": sorted(list(categories_set)),
        "families": sorted(list(families_set))
    }
