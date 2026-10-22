import pandas as pd
import numpy as np
from typing import Dict, Any, List
from app.schemas import KPICards, FactRecord, StorePerformance, ProductPerformance, AppSettings

def calculate_kpis(fact_df: pd.DataFrame, timeline_df: pd.DataFrame, settings: AppSettings) -> Dict[str, Any]:
    """
    Computes overall summary KPIs across PROMO_FACT dataframe.
    """
    if fact_df.empty:
        return {
            "total_stores": 0,
            "total_products": 0,
            "total_forecast": 0.0,
            "total_sales": 0.0,
            "achievement_pct": None,
            "total_stock": 0.0,
            "stockout_stores_count": 0,
            "stockout_products_count": 0,
            "stockout_rate_pct": 0.0,
            "sell_through_pct": None,
            "wape_pct": 0.0,
            "mae": 0.0,
            "rmse": 0.0,
            "bias": 0.0,
            "promo_health_score": 0.0,
            "promo_health_status": "Critical"
        }
        
    total_stores = int(fact_df['STORE'].nunique())
    total_products = int(fact_df['CODE'].nunique())
    total_fc = float(fact_df['FC'].sum())
    total_fc_mebleg = float(fact_df['FC_MEBLEG'].sum()) if 'FC_MEBLEG' in fact_df.columns else 0.0
    total_sale = float(fact_df['SALE'].sum())
    total_stock = float(fact_df['FINAL_STOCK'].sum())
    
    # Achievement % = SALE / FC * 100
    achievement_pct = round((total_sale / total_fc) * 100.0, 2) if total_fc > 0 else None
    
    # Sell Through = SALE / (SALE + FINAL_STOCK) * 100
    denominator = total_sale + total_stock
    sell_through_pct = round((total_sale / denominator) * 100.0, 2) if denominator > 0 else None
    
    # Stockouts (where FINAL_STOCK == 0)
    stockout_mask = fact_df['FINAL_STOCK'] <= 0.0001
    stockout_rows = fact_df[stockout_mask]
    
    stockout_stores_count = int(stockout_rows['STORE'].nunique())
    stockout_products_count = int(stockout_rows['CODE'].nunique())
    total_combinations = len(fact_df)
    stockout_rate_pct = round((len(stockout_rows) / total_combinations) * 100.0, 2) if total_combinations > 0 else 0.0
    availability_pct = round(100.0 - stockout_rate_pct, 1) if total_combinations > 0 else 100.0

    return {
        "total_stores": total_stores,
        "total_products": total_products,
        "total_forecast": round(total_fc, 2),
        "total_forecast_azn": round(total_fc_mebleg, 2),
        "total_sales": round(total_sale, 2),
        "achievement_pct": achievement_pct,
        "total_stock": round(total_stock, 2),
        "stockout_stores_count": stockout_stores_count,
        "stockout_products_count": stockout_products_count,
        "stockout_rate_pct": stockout_rate_pct,
        "availability_pct": availability_pct,
        "sell_through_pct": sell_through_pct,
        "total_combinations": total_combinations
    }

def compute_fact_records(fact_df: pd.DataFrame, settings: AppSettings) -> List[FactRecord]:
    """Calculates row-level metrics for PROMO_FACT using high-performance numpy vectorization."""
    if fact_df.empty:
        return []

    stores = fact_df['STORE'].astype(str).tolist()
    codes = fact_df['CODE'].astype(str).tolist()
    names = fact_df['NAME'].astype(str).tolist()

    fcs = pd.to_numeric(fact_df['FC'], errors='coerce').fillna(0.0).clip(lower=0.0).to_numpy(dtype=float)
    fc_meblegs = pd.to_numeric(fact_df['FC_MEBLEG'], errors='coerce').fillna(0.0).clip(lower=0.0).to_numpy(dtype=float) if 'FC_MEBLEG' in fact_df.columns else np.zeros(len(fact_df))
    sales = pd.to_numeric(fact_df['SALE'], errors='coerce').fillna(0.0).clip(lower=0.0).to_numpy(dtype=float)
    stocks = pd.to_numeric(fact_df['FINAL_STOCK'], errors='coerce').fillna(0.0).clip(lower=0.0).to_numpy(dtype=float)

    safe_fcs = np.where(fcs > 0, fcs, 1.0)
    ach_pcts = np.where(fcs > 0, np.round((sales / safe_fcs) * 100.0, 2), None)
    errors = np.round(sales - fcs, 2)
    abs_errors = np.round(np.abs(errors), 2)
    under_fcs = np.round(np.maximum(fcs - sales, 0.0), 2)
    over_fcs = np.round(np.maximum(sales - fcs, 0.0), 2)

    denoms = sales + stocks
    safe_denoms = np.where(denoms > 0, denoms, 1.0)
    sell_throughs = np.where(denoms > 0, np.round((sales / safe_denoms) * 100.0, 2), None)
    is_stockouts = stocks <= 0.0001

    ach_ratios = np.where(fcs > 0, (sales / safe_fcs) * 100.0, 0.0)
    crit_limit = settings.achievement_critical
    over_limit = settings.achievement_over

    n_rows = len(fact_df)
    statuses = []
    for i in range(n_rows):
        stk_out = is_stockouts[i]
        fc = fcs[i]
        sale = sales[i]
        stk = stocks[i]
        ach_r = ach_ratios[i]

        if stk_out and fc > sale:
            status = "STOCKOUT_LIMITED"
        elif fc > 0 and ach_r < crit_limit and stk > 0:
            status = "BELOW_TARGET"
        elif fc > 0 and ach_r < crit_limit:
            status = "UNDER_FORECAST"
        elif fc > 0 and ach_r >= over_limit:
            status = "OVER_PERFORMING"
        else:
            status = "HEALTHY"
        statuses.append(status)

    refs = pd.to_numeric(fact_df['REF'], errors='coerce').to_numpy(dtype=object) if 'REF' in fact_df.columns else np.array([None] * len(fact_df), dtype=object)
    promo_types = fact_df['PROMO_TYPE'].astype(str).tolist() if 'PROMO_TYPE' in fact_df.columns else ["adi"] * n_rows
    categories = fact_df['CATEGORY'].fillna("").astype(str).tolist() if 'CATEGORY' in fact_df.columns else [""] * n_rows
    sub_categories = fact_df['SUB_CATEGORY'].fillna("").astype(str).tolist() if 'SUB_CATEGORY' in fact_df.columns else [""] * n_rows
    areas = fact_df['AREA'].fillna("").astype(str).tolist() if 'AREA' in fact_df.columns else [""] * n_rows
    sub_areas = fact_df['SUB_AREA'].fillna("").astype(str).tolist() if 'SUB_AREA' in fact_df.columns else [""] * n_rows

    records = [
        FactRecord(
            store=stores[i],
            code=codes[i],
            name=names[i],
            fc=round(float(fcs[i]), 2),
            fc_mebleg=round(float(fc_meblegs[i]), 2),
            sale=round(float(sales[i]), 2),
            final_stock=round(float(stocks[i]), 2),
            ref=float(refs[i]) if (refs[i] is not None and pd.notnull(refs[i])) else None,
            achievement_pct=float(ach_pcts[i]) if ach_pcts[i] is not None else None,
            error=float(errors[i]),
            abs_error=float(abs_errors[i]),
            under_forecast=float(under_fcs[i]),
            over_forecast=float(over_fcs[i]),
            sell_through_pct=float(sell_throughs[i]) if sell_throughs[i] is not None else None,
            is_stockout=bool(is_stockouts[i]),
            promo_type=promo_types[i],
            category=categories[i] if categories[i] and categories[i] not in ("None", "nan") else None,
            sub_category=sub_categories[i] if sub_categories[i] and sub_categories[i] not in ("None", "nan") else None,
            area=areas[i] if areas[i] and areas[i] not in ("None", "nan") else None,
            sub_area=sub_areas[i] if sub_areas[i] and sub_areas[i] not in ("None", "nan") else None,
            status=statuses[i]
        )
        for i in range(n_rows)
    ]
    return records
