import re
import os
from datetime import datetime
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Set
from collections import Counter

UNASSIGNED_LABEL = "Təyin edilməyib"

# Config constant for arbitrary N-level tree hierarchies
TREE_LEVELS: Dict[str, List[str]] = {
    "category": ["category", "sub_category", "family"],
    "area": ["area", "sub_area"]
}

LEVEL_SPEC: Dict[str, Tuple[str, str]] = {
    "category": ("CATEGORY", "_cat_key"),
    "sub_category": ("SUB_CATEGORY", "_sub_cat_key"),
    "family": ("FAMILY", "_family_key"),
    "area": ("AREA", "_area_key"),
    "sub_area": ("SUB_AREA", "_sub_area_key"),
}

def normalize_grouping_key(val: Any) -> str:
    """
    Normalizes a category, sub-category, family, area, or sub-area value to a canonical grouping key:
    - If None, NaN, empty string, or whitespace-only -> UNASSIGNED_LABEL ("Təyin edilməyib")
    - Trims leading/trailing whitespace
    - Collapses multiple whitespace characters into a single space
    - Casefolds with tolerant Azerbaijani letter handling:
      'İ'/'I'/'ı' -> 'i', 'Ə'/'ə' -> 'ə', 'Ş'/'ş' -> 'ş', 'Ç'/'ç' -> 'ç',
      'Ö'/'ö' -> 'ö', 'Ü'/'ü' -> 'ü', 'Ğ'/'ğ' -> 'ğ'
    """
    if val is None or pd.isna(val):
        return UNASSIGNED_LABEL
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", "null", "təyin edilməyib", "teyin edilmeyib", "unassigned"):
        return UNASSIGNED_LABEL
    # Collapse whitespace
    s = re.sub(r'\s+', ' ', s)
    trans = str.maketrans({
        'İ': 'i', 'I': 'i', 'ı': 'i',
        'Ə': 'ə',
        'Ş': 'ş',
        'Ç': 'ç',
        'Ö': 'ö',
        'Ü': 'ü',
        'Ğ': 'ğ'
    })
    return s.translate(trans).lower()

def compute_display_names(series: pd.Series) -> Dict[str, str]:
    """
    For each canonical grouping key, determine the most frequent original spelling.
    Uses value_counts() to operate in O(num_distinct) instead of O(num_rows).
    Returns mapping: { canonical_key: display_name }
    """
    key_to_counter: Dict[str, Counter] = {}
    counts = series.dropna().value_counts()
    for val, count in counts.items():
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none", "null", "təyin edilməyib", "teyin edilmeyib", "unassigned"):
            continue
        canon = normalize_grouping_key(s)
        if canon == UNASSIGNED_LABEL:
            continue
        cleaned_orig = re.sub(r'\s+', ' ', s)
        if canon not in key_to_counter:
            key_to_counter[canon] = Counter()
        key_to_counter[canon][cleaned_orig] += count

    display_map: Dict[str, str] = {UNASSIGNED_LABEL: UNASSIGNED_LABEL}
    for canon, counter in key_to_counter.items():
        most_common_name = counter.most_common(1)[0][0]
        display_map[canon] = most_common_name

    return display_map

def get_canonical_series(series: pd.Series) -> pd.Series:
    """Fast mapping of series values to canonical keys using unique dictionary cache."""
    uniques = series.dropna().unique()
    val_map = {u: normalize_grouping_key(u) for u in uniques}
    return series.map(val_map).fillna(UNASSIGNED_LABEL)

def compute_daily_group_sales(
    df: pd.DataFrame,
    dimension: str,
    root_nodes: List[Dict[str, Any]],
    display_map: Dict[str, str],
    beg_date: Optional[str] = None,
    end_date: Optional[str] = None,
    as_of_date: Optional[str] = None,
    timeline_df: Optional[pd.DataFrame] = None
) -> List[Dict[str, Any]]:
    """
    Computes daily timeline metrics broken down by Area or Category for the dynamic chart.
    """
    if df is None or df.empty:
        return []

    from app.db import SALES_PARQUET

    dim_lower = dimension.strip().lower()
    dim_col = 'AREA' if dim_lower == 'area' else 'CATEGORY'
    if dim_col not in df.columns:
        return []

    group_names = [n["name"] for n in root_nodes if n.get("name")]
    if not group_names:
        return []

    # Infer campaign dates if not passed
    if not beg_date or not end_date:
        if timeline_df is not None and not timeline_df.empty and 'STOCK_DATE' in timeline_df.columns:
            t_dates = sorted(timeline_df['STOCK_DATE'].dropna().unique().tolist())
            if t_dates:
                beg_date = t_dates[0]
                end_date = t_dates[-1]

    if not beg_date or not end_date:
        return []

    try:
        campaign_dates = [d.strftime("%Y-%m-%d") for d in pd.date_range(beg_date, end_date)]
    except Exception:
        campaign_dates = []
    if not campaign_dates:
        return []

    # Map raw value to canonical display name
    df_mapped = df[['STORE', 'CODE', dim_col, 'FC']].copy()
    df_mapped['disp_group'] = df_mapped[dim_col].map(
        lambda v: display_map.get(normalize_grouping_key(v), str(v) if pd.notna(v) else UNASSIGNED_LABEL)
    )
    group_fc = df_mapped.groupby('disp_group')['FC'].sum().to_dict()
    total_fc = sum(group_fc.values())

    # Calculate daily sales by group from SALES_PARQUET
    daily_grp = None
    available_dates = []

    if os.path.exists(SALES_PARQUET):
        try:
            items = list(df_mapped['CODE'].astype(str).str.strip().unique())
            stores = list(df_mapped['STORE'].astype(str).str.strip().str.lstrip('0').unique())

            sales_filters = [
                ('sale_date', '>=', beg_date),
                ('sale_date', '<=', end_date)
            ]
            if items:
                sales_filters.append(('item_code', 'in', items))
            if stores:
                sales_filters.append(('store_code', 'in', stores))

            sales_df = pd.read_parquet(SALES_PARQUET, engine='pyarrow', filters=sales_filters)
            if not sales_df.empty:
                sales_df['norm_st'] = sales_df['store_code'].astype(str).str.strip().str.lstrip('0')
                sales_df['norm_cd'] = sales_df['item_code'].astype(str).str.strip()

                df_mapped['norm_st'] = df_mapped['STORE'].astype(str).str.strip().str.lstrip('0')
                df_mapped['norm_cd'] = df_mapped['CODE'].astype(str).str.strip()

                matched = pd.merge(sales_df, df_mapped[['norm_st', 'norm_cd', 'disp_group']], on=['norm_st', 'norm_cd'], how='inner')
                if not matched.empty:
                    matched['sale_date_clean'] = matched['sale_date'].astype(str).str[:10]
                    matched['sales_qty'] = pd.to_numeric(matched['sales_qty'], errors='coerce').fillna(0.0).clip(lower=0.0)
                    daily_grp = matched.groupby(['sale_date_clean', 'disp_group'])['sales_qty'].sum().unstack(fill_value=0.0)
                    available_dates = sorted([d for d in daily_grp.index.tolist() if beg_date <= d <= end_date])
        except Exception as e:
            print(f"[DEBUG] compute_daily_group_sales parquet error: {e}")

    # Fallback to timeline_df if sales_df was empty or unavailable
    if (daily_grp is None or daily_grp.empty) and timeline_df is not None and not timeline_df.empty and 'STOCK_DATE' in timeline_df.columns:
        try:
            t_copy = timeline_df.copy()
            t_copy['norm_st'] = t_copy['STORE'].astype(str).str.strip().str.lstrip('0')
            t_copy['norm_cd'] = t_copy['CODE'].astype(str).str.strip()
            df_mapped['norm_st'] = df_mapped['STORE'].astype(str).str.strip().str.lstrip('0')
            df_mapped['norm_cd'] = df_mapped['CODE'].astype(str).str.strip()

            t_merged = pd.merge(t_copy, df_mapped[['norm_st', 'norm_cd', 'disp_group']], on=['norm_st', 'norm_cd'], how='inner')
            if not t_merged.empty and len(t_merged['STOCK_DATE'].unique()) > 1:
                pivot = t_merged.pivot_table(index=['norm_st', 'norm_cd', 'disp_group'], columns='STOCK_DATE', values='STOCK_QTY', aggfunc='last').fillna(0.0)
                col_dates = sorted(pivot.columns.tolist())
                depletions = {}
                for idx in range(1, len(col_dates)):
                    d_prev = col_dates[idx - 1]
                    d_curr = col_dates[idx]
                    dep = (pivot[d_prev] - pivot[d_curr]).clip(lower=0.0)
                    depletions[d_curr] = dep.groupby('disp_group').sum()
                if depletions:
                    daily_grp = pd.DataFrame(depletions).T.fillna(0.0)
                    available_dates = sorted(daily_grp.index.tolist())
        except Exception as e:
            print(f"[DEBUG] compute_daily_group_sales timeline fallback error: {e}")

    latest_available_date = max(available_dates) if available_dates else beg_date
    today_str = as_of_date or datetime.now().strftime("%Y-%m-%d")
    N = max(len(campaign_dates), 1)

    running_cum = {g: 0.0 for g in group_names}
    running_total = 0.0
    timeline = []

    for i, d_str in enumerate(campaign_dates, start=1):
        ideal_pct = round((i / N) * 100.0, 2)
        is_future = bool(available_dates and d_str > latest_available_date)
        is_partial = bool(d_str == today_str and d_str == latest_available_date)

        day_entry: Dict[str, Any] = {
            "date": d_str,
            "display_date": f"{d_str[8:10]}.{d_str[5:7]}",
            "day": i,
            "ideal_pct": ideal_pct,
            "is_future": is_future,
            "partial": is_partial,
            "groups": {}
        }

        if not is_future and daily_grp is not None and not daily_grp.empty:
            day_total = 0.0
            for g in group_names:
                sale_qty = float(daily_grp.loc[d_str, g]) if (d_str in daily_grp.index and g in daily_grp.columns) else 0.0
                running_cum[g] += sale_qty
                g_fc = group_fc.get(g, 0.0)
                g_ach = round((running_cum[g] / g_fc * 100.0), 2) if g_fc > 0 else 0.0
                day_total += sale_qty

                day_entry["groups"][g] = {
                    "daily_sale": round(sale_qty, 1),
                    "cumulative_sale": round(running_cum[g], 1),
                    "achievement_pct": g_ach,
                    "fc": round(g_fc, 1)
                }
            running_total += day_total
            total_ach = round((running_total / total_fc * 100.0), 2) if total_fc > 0 else 0.0
            day_entry["groups"]["ALL"] = {
                "daily_sale": round(day_total, 1),
                "cumulative_sale": round(running_total, 1),
                "achievement_pct": total_ach,
                "fc": round(total_fc, 1)
            }
        else:
            for g in group_names:
                day_entry["groups"][g] = {
                    "daily_sale": None,
                    "cumulative_sale": None,
                    "achievement_pct": None,
                    "fc": round(group_fc.get(g, 0.0), 1)
                }
            day_entry["groups"]["ALL"] = {
                "daily_sale": None,
                "cumulative_sale": None,
                "achievement_pct": None,
                "fc": round(total_fc, 1)
            }

        timeline.append(day_entry)

    return timeline

def aggregate_by_group(
    fact_df: pd.DataFrame,
    dimension: str,
    category: Optional[str] = None,
    area: Optional[str] = None,
    sub_area: Optional[str] = None,
    store: Optional[str] = None,
    family: Optional[str] = None,
    product: Optional[str] = None,
    beg_date: Optional[str] = None,
    end_date: Optional[str] = None,
    as_of_date: Optional[str] = None,
    timeline_df: Optional[pd.DataFrame] = None
) -> Dict[str, Any]:
    """
    Single source of truth generic N-level tree aggregation for Category Analiz & Area Analiz.
    Hierarchy driven by TREE_LEVELS:
    - dimension == 'category': Category (level 0) -> Sub Category (level 1) -> Family (level 2)
    - dimension == 'area': Area (level 0) -> Sub Area (level 1)

    Node identity is the full PATH key ("||".join of canonical keys).
    Reuses the exact same metric definitions as the Dashboard:
    fc, sale, achievement_pct, stock, stockout_pairs, stockout_pct, osa_pct, distribution_qty,
    share_of_total_sale_pct.
    """
    dim_lower = dimension.strip().lower()

    if fact_df is None or fact_df.empty:
        empty_totals = {
            "stores": 0, "skus": 0, "pairs": 0, "fc": 0.0, "sale": 0.0,
            "achievement_pct": None, "stock": 0.0, "stockout_pairs": 0,
            "stockout_pct": 0.0, "osa_pct": 100.0, "distribution_qty": 0.0,
            "share_of_total_sale_pct": 0.0
        }
        return {
            "dimension": dimension,
            "nodes": [],
            "groups": [],
            "totals": empty_totals,
            "unassigned": {"pairs": 0, "share_pct": 0.0},
            "filter_options": {"categories": [], "areas": []},
            "daily_timeline": []
        }

    df = fact_df.copy()
    df.columns = [str(c).upper() for c in df.columns]

    for col_name in ['CATEGORY', 'SUB_CATEGORY', 'FAMILY', 'AREA', 'SUB_AREA']:
        if col_name not in df.columns:
            df[col_name] = None
    if 'DISTRIBUTION_QTY' not in df.columns:
        df['DISTRIBUTION_QTY'] = df['SALE'] + df['FINAL_STOCK']

    # Vectorized canonical grouping keys
    for dim_key, (raw_col, key_col) in LEVEL_SPEC.items():
        df[key_col] = get_canonical_series(df[raw_col])

    # Display name maps computed before filtering
    display_maps = {
        dim_key: compute_display_names(df[raw_col])
        for dim_key, (raw_col, _) in LEVEL_SPEC.items()
    }

    filter_categories = sorted(list(set(display_maps["category"].values())), key=lambda x: (x == UNASSIGNED_LABEL, x.lower()))
    filter_areas = sorted(list(set(display_maps["area"].values())), key=lambda x: (x == UNASSIGNED_LABEL, x.lower()))

    # Apply Global Filters
    if category and category.strip() and category.strip() != "ALL":
        target_norm_cat = normalize_grouping_key(category)
        df = df[df['_cat_key'] == target_norm_cat]

    if area and area.strip() and area.strip() != "ALL":
        target_norm_area = normalize_grouping_key(area)
        df = df[df['_area_key'] == target_norm_area]

    if sub_area and sub_area.strip() and sub_area.strip() != "ALL":
        target_norm_sub_area = normalize_grouping_key(sub_area)
        df = df[df['_sub_area_key'] == target_norm_sub_area]

    if store and store.strip() and store.strip() != "ALL":
        norm_store = str(store).strip().lstrip('0')
        df = df[df['STORE'].astype(str).str.strip().str.lstrip('0') == norm_store]

    if family and family.strip() and family.strip() != "ALL":
        target_norm_family = normalize_grouping_key(family)
        df = df[df['_family_key'] == target_norm_family]

    if product and product.strip() and product.strip() != "ALL":
        norm_code = str(product).strip()
        df = df[df['CODE'].astype(str).str.strip() == norm_code]

    if df.empty:
        empty_totals = {
            "stores": 0, "skus": 0, "pairs": 0, "fc": 0.0, "sale": 0.0,
            "achievement_pct": None, "stock": 0.0, "stockout_pairs": 0,
            "stockout_pct": 0.0, "osa_pct": 100.0, "distribution_qty": 0.0,
            "share_of_total_sale_pct": 0.0
        }
        return {
            "dimension": dimension,
            "nodes": [],
            "groups": [],
            "totals": empty_totals,
            "unassigned": {"pairs": 0, "share_pct": 0.0},
            "filter_options": {"categories": filter_categories, "areas": filter_areas},
            "daily_timeline": []
        }

    # Ensure numeric columns
    df['FC'] = pd.to_numeric(df['FC'], errors='coerce').fillna(0.0)
    df['SALE'] = pd.to_numeric(df['SALE'], errors='coerce').fillna(0.0)
    df['FINAL_STOCK'] = pd.to_numeric(df['FINAL_STOCK'], errors='coerce').fillna(0.0)
    df['DISTRIBUTION_QTY'] = pd.to_numeric(df['DISTRIBUTION_QTY'], errors='coerce').fillna(0.0)
    df['_is_stockout'] = (df['FINAL_STOCK'] <= 0.0001).astype(int)

    # Totals (Dashboard level)
    total_pairs = len(df)
    total_stores = int(df['STORE'].nunique()) if total_pairs > 0 else 0
    total_skus = int(df['CODE'].nunique()) if total_pairs > 0 else 0
    total_fc = float(df['FC'].sum())
    total_sale = float(df['SALE'].sum())
    total_stock = float(df['FINAL_STOCK'].sum())
    total_stockout_pairs = int(df['_is_stockout'].sum())
    total_dist = float(df['DISTRIBUTION_QTY'].sum())

    total_ach = round((total_sale / total_fc) * 100.0, 1) if total_fc > 0 else None
    total_stout_pct = round((total_stockout_pairs / total_pairs) * 100.0, 1) if total_pairs > 0 else 0.0
    total_osa_pct = round(100.0 - total_stout_pct, 1) if total_pairs > 0 else 100.0

    totals = {
        "stores": total_stores,
        "skus": total_skus,
        "pairs": total_pairs,
        "fc": round(total_fc, 1),
        "sale": round(total_sale, 1),
        "achievement_pct": total_ach,
        "stock": round(total_stock, 1),
        "stockout_pairs": total_stockout_pairs,
        "stockout_pct": total_stout_pct,
        "osa_pct": total_osa_pct,
        "distribution_qty": round(total_dist, 1),
        "share_of_total_sale_pct": 100.0 if total_sale > 0 else 0.0
    }

    # Generic N-level tree builder driven by TREE_LEVELS
    level_dims = TREE_LEVELS.get(dim_lower, ["category", "sub_category", "family"])
    num_levels = len(level_dims)
    key_cols = [LEVEL_SPEC[d][1] for d in level_dims]

    # Pre-aggregate at each depth d (0 to num_levels - 1)
    # Store nodes in dict: level_nodes[d][tuple_of_canonical_keys] = node_dict
    level_nodes: List[Dict[Tuple[str, ...], Dict[str, Any]]] = [{} for _ in range(num_levels)]

    for d in range(num_levels):
        curr_key_cols = key_cols[:d + 1]
        dim_name = level_dims[d]
        disp_map = display_maps[dim_name]

        grouped = df.groupby(curr_key_cols, as_index=False).agg(
            stores=('STORE', 'nunique'),
            skus=('CODE', 'nunique'),
            pairs=('CODE', 'count'),
            fc=('FC', 'sum'),
            sale=('SALE', 'sum'),
            stock=('FINAL_STOCK', 'sum'),
            stockout_pairs=('_is_stockout', 'sum'),
            distribution_qty=('DISTRIBUTION_QTY', 'sum')
        )

        for rec in grouped.to_dict(orient='records'):
            ktup = tuple(str(rec[c]) for c in curr_key_cols)
            cur_canon_val = ktup[-1]
            disp_name = disp_map.get(cur_canon_val, cur_canon_val)
            path_names = [display_maps[level_dims[i]].get(ktup[i], ktup[i]) for i in range(d + 1)]
            
            p_pairs = int(rec['pairs'])
            p_fc = float(rec['fc'])
            p_sale = float(rec['sale'])
            p_stock = float(rec['stock'])
            p_stout = int(rec['stockout_pairs'])
            p_dist = float(rec['distribution_qty'])

            p_ach = round((p_sale / p_fc) * 100.0, 1) if p_fc > 0 else None
            p_stout_pct = round((p_stout / p_pairs) * 100.0, 1) if p_pairs > 0 else 0.0
            p_osa = round(100.0 - p_stout_pct, 1) if p_pairs > 0 else 100.0
            p_share = round((p_sale / total_sale) * 100.0, 1) if total_sale > 0 else 0.0

            node: Dict[str, Any] = {
                "key": "||".join(ktup),
                "name": disp_name,
                "group_key": ktup[0],
                "parent_key": ktup[d - 1] if d > 0 else ktup[0],
                "sub_key": ktup[d] if d > 0 else None,
                "parent_name": path_names[d - 1] if d > 0 else None,
                "path": path_names,
                "level": d,
                "children_count": 0,
                "stores": int(rec['stores']),
                "skus": int(rec['skus']),
                "pairs": p_pairs,
                "fc": round(p_fc, 1),
                "sale": round(p_sale, 1),
                "achievement_pct": p_ach,
                "stock": round(p_stock, 1),
                "stockout_pairs": p_stout,
                "stockout_pct": p_stout_pct,
                "osa_pct": p_osa,
                "distribution_qty": round(p_dist, 1),
                "share_of_total_sale_pct": p_share,
                "children": []
            }
            level_nodes[d][ktup] = node

    # Nest children into parents from deepest level back to root
    for d in range(num_levels - 2, -1, -1):
        for child_ktup, child_node in level_nodes[d + 1].items():
            parent_ktup = child_ktup[:-1]
            if parent_ktup in level_nodes[d]:
                level_nodes[d][parent_ktup]["children"].append(child_node)

        # Sort children of each node at level d by sale descending
        for parent_node in level_nodes[d].values():
            parent_node["children"].sort(key=lambda c: c['sale'], reverse=True)
            parent_node["children_count"] = len(parent_node["children"])

    # Root nodes (level 0)
    root_nodes = list(level_nodes[0].values())
    root_nodes.sort(key=lambda p: p['sale'], reverse=True)

    unassigned_node = next((p for p in root_nodes if p["name"] == UNASSIGNED_LABEL or p["key"] == UNASSIGNED_LABEL), None)
    unassigned_pairs = unassigned_node["pairs"] if unassigned_node else 0
    unassigned_share_pct = unassigned_node["share_of_total_sale_pct"] if unassigned_node else 0.0

    daily_timeline = compute_daily_group_sales(
        df=df,
        dimension=dim_lower,
        root_nodes=root_nodes,
        display_map=display_maps[dim_lower],
        beg_date=beg_date,
        end_date=end_date,
        as_of_date=as_of_date,
        timeline_df=timeline_df
    )

    return {
        "dimension": dimension,
        "nodes": root_nodes,
        "groups": root_nodes,
        "totals": totals,
        "unassigned": {
            "pairs": unassigned_pairs,
            "share_pct": unassigned_share_pct
        },
        "filter_options": {
            "categories": filter_categories,
            "areas": filter_areas
        },
        "daily_timeline": daily_timeline
    }

def get_group_detail(
    fact_df: pd.DataFrame,
    dimension: str,
    path: Optional[List[str]] = None,
    name: Optional[str] = None,
    parent: Optional[str] = None,
    sub: Optional[str] = None,
    category: Optional[str] = None,
    area: Optional[str] = None,
    sub_area: Optional[str] = None,
    store: Optional[str] = None,
    family: Optional[str] = None,
    product: Optional[str] = None
) -> Dict[str, Any]:
    """
    Returns drill-down rows for a specific node identified by its path:
    - For dimension == 'category': returns product rows (code, name, fc, sale, achievement, stock, stockout_store_count, store_count)
    - For dimension == 'area': returns store rows (store, fc, sale, achievement, stock, stockout_sku_count, sku_count)

    Supports path of 1 to 3 segments (e.g. path=['Cat'], path=['Cat', 'Sub'], path=['Cat', 'Sub', 'Family']).
    Also supports backward compatibility arguments (name, parent, sub).
    """
    if fact_df is None or fact_df.empty:
        return {"dimension": dimension, "path": path or [], "name": name or "", "items": []}

    df = fact_df.copy()
    df.columns = [str(c).upper() for c in df.columns]
    dim_lower = dimension.strip().lower()

    for col_name in ['CATEGORY', 'SUB_CATEGORY', 'FAMILY', 'AREA', 'SUB_AREA']:
        if col_name not in df.columns:
            df[col_name] = None

    # Resolve path segments
    path_segments: List[str] = []
    if path and len(path) > 0:
        path_segments = [str(p) for p in path if str(p).strip()]
    elif parent or name:
        p_val = parent if parent is not None else (name or "")
        path_segments = [p_val]
        if sub and sub.strip() and sub.strip() != "ALL":
            path_segments.append(sub)

    level_dims = TREE_LEVELS.get(dim_lower, ["category", "sub_category", "family"])
    key_cols = [LEVEL_SPEC[d][1] for d in level_dims]

    for dim_key in level_dims:
        raw_col, k_col = LEVEL_SPEC[dim_key]
        df[k_col] = get_canonical_series(df[raw_col])

    # Filter by each path segment up to available key columns
    mask = pd.Series(True, index=df.index)
    for idx, seg in enumerate(path_segments):
        if idx < len(key_cols):
            norm_target = normalize_grouping_key(seg)
            mask = mask & (df[key_cols[idx]] == norm_target)

    # Apply Global Filters
    if category and category.strip() and category.strip() != "ALL":
        target_norm_cat = normalize_grouping_key(category)
        mask = mask & (df['_cat_key'] == target_norm_cat)

    if area and area.strip() and area.strip() != "ALL":
        target_norm_area = normalize_grouping_key(area)
        mask = mask & (df['_area_key'] == target_norm_area)

    if sub_area and sub_area.strip() and sub_area.strip() != "ALL":
        target_norm_sub_area = normalize_grouping_key(sub_area)
        mask = mask & (df['_sub_area_key'] == target_norm_sub_area)

    if store and store.strip() and store.strip() != "ALL":
        norm_store = str(store).strip().lstrip('0')
        mask = mask & (df['STORE'].astype(str).str.strip().str.lstrip('0') == norm_store)

    if family and family.strip() and family.strip() != "ALL":
        target_norm_family = normalize_grouping_key(family)
        mask = mask & (df['_family_key'] == target_norm_family)

    if product and product.strip() and product.strip() != "ALL":
        norm_code = str(product).strip()
        mask = mask & (df['CODE'].astype(str).str.strip() == norm_code)

    sub_df = df[mask]
    if sub_df.empty:
        return {
            "dimension": dimension,
            "path": path_segments,
            "name": path_segments[0] if path_segments else (name or ""),
            "items": []
        }

    sub_df['FC'] = pd.to_numeric(sub_df['FC'], errors='coerce').fillna(0.0)
    sub_df['SALE'] = pd.to_numeric(sub_df['SALE'], errors='coerce').fillna(0.0)
    sub_df['FINAL_STOCK'] = pd.to_numeric(sub_df['FINAL_STOCK'], errors='coerce').fillna(0.0)
    sub_df['_is_stockout'] = (sub_df['FINAL_STOCK'] <= 0.0001).astype(int)

    items: List[Dict[str, Any]] = []

    if dim_lower == 'category':
        # Product breakdown
        p_agg = sub_df.groupby('CODE', as_index=False).agg(
            name=('NAME', 'first'),
            fc=('FC', 'sum'),
            sale=('SALE', 'sum'),
            stock=('FINAL_STOCK', 'sum'),
            stockout_store_count=('_is_stockout', 'sum'),
            store_count=('STORE', 'nunique')
        )
        for r in p_agg.to_dict(orient='records'):
            fc_val = float(r['fc'])
            sale_val = float(r['sale'])
            ach_val = round((sale_val / fc_val) * 100.0, 1) if fc_val > 0 else None
            items.append({
                "code": str(r['CODE']),
                "name": str(r['name']),
                "fc": round(fc_val, 1),
                "sale": round(sale_val, 1),
                "achievement": ach_val,
                "stock": round(float(r['stock']), 1),
                "stockout_store_count": int(r['stockout_store_count']),
                "store_count": int(r['store_count'])
            })
    else:
        # Store breakdown
        s_agg = sub_df.groupby('STORE', as_index=False).agg(
            fc=('FC', 'sum'),
            sale=('SALE', 'sum'),
            stock=('FINAL_STOCK', 'sum'),
            stockout_sku_count=('_is_stockout', 'sum'),
            sku_count=('CODE', 'nunique')
        )
        for r in s_agg.to_dict(orient='records'):
            fc_val = float(r['fc'])
            sale_val = float(r['sale'])
            ach_val = round((sale_val / fc_val) * 100.0, 1) if fc_val > 0 else None
            items.append({
                "store": str(r['STORE']),
                "fc": round(fc_val, 1),
                "sale": round(sale_val, 1),
                "achievement": ach_val,
                "stock": round(float(r['stock']), 1),
                "stockout_sku_count": int(r['stockout_sku_count']),
                "sku_count": int(r['sku_count'])
            })

    items.sort(key=lambda x: x['sale'], reverse=True)
    return {
        "dimension": dimension,
        "path": path_segments,
        "name": path_segments[0] if path_segments else (name or ""),
        "parent": path_segments[0] if path_segments else (name or ""),
        "sub": path_segments[1] if len(path_segments) > 1 else None,
        "items": items
    }
