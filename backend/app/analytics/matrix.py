import pandas as pd
import numpy as np
from typing import Dict, List, Any
from app.schemas import ProductStoreMatrix, AppSettings

def build_product_store_matrix(fact_df: pd.DataFrame, timeline_df: pd.DataFrame = None, metric: str = "achievement", date_str: str = None) -> ProductStoreMatrix:
    """Builds Product x Store matrix heatmap dataset with optional date snapshot filtering with vectorized speed."""
    if fact_df.empty:
        return ProductStoreMatrix(stores=[], products=[], metric=metric, cells=[])

    # Sort stores naturally (numeric stores 1, 2, 3.. before non-numeric)
    stores = sorted(
        [str(s) for s in fact_df['STORE'].unique().tolist()],
        key=lambda s: (0, int(s)) if s.isdigit() else (1, s)
    )

    # Products list sorted by total sales
    has_category = 'CATEGORY' in fact_df.columns
    agg_dict: Dict[str, Any] = {'NAME': 'first', 'SALE': 'sum'}
    if has_category:
        agg_dict['CATEGORY'] = 'first'

    p_meta = fact_df.groupby('CODE', as_index=False).agg(agg_dict).sort_values('SALE', ascending=False)
    
    products = []
    for _, row in p_meta.iterrows():
        p_dict: Dict[str, str] = {
            "code": str(row['CODE']),
            "name": str(row['NAME']) if pd.notnull(row['NAME']) else str(row['CODE'])
        }
        if has_category and pd.notnull(row.get('CATEGORY')):
            p_dict["category"] = str(row['CATEGORY'])
        products.append(p_dict)

    # Fast date stock lookup if date snapshot requested
    df = fact_df.copy()
    if date_str and timeline_df is not None and not timeline_df.empty:
        sub_t = timeline_df[timeline_df['STOCK_DATE'] == date_str][['STORE', 'CODE', 'STOCK_QTY']].rename(columns={'STOCK_QTY': '_date_stock'})
        df = df.merge(sub_t, on=['STORE', 'CODE'], how='left')
        stocks = pd.to_numeric(df['_date_stock'].fillna(df['FINAL_STOCK']), errors='coerce').fillna(0.0).to_numpy(dtype=float)
    else:
        stocks = pd.to_numeric(df['FINAL_STOCK'], errors='coerce').fillna(0.0).to_numpy(dtype=float)

    fcs = pd.to_numeric(df['FC'], errors='coerce').fillna(0.0).to_numpy(dtype=float)
    sales = pd.to_numeric(df['SALE'], errors='coerce').fillna(0.0).to_numpy(dtype=float)
    stores_arr = df['STORE'].astype(str).to_numpy()
    codes_arr = df['CODE'].astype(str).to_numpy()

    # Vectorized metric value and status computation
    if metric == "forecast":
        vals = fcs
        statuses = np.full(len(df), "NEUTRAL", dtype=object)
    elif metric == "sales":
        vals = sales
        statuses = np.full(len(df), "NEUTRAL", dtype=object)
    elif metric == "stock":
        vals = stocks
        statuses = np.where(stocks <= 0.0001, "CRITICAL", "HEALTHY")
    elif metric == "stockout":
        vals = np.where(stocks <= 0.0001, 1.0, 0.0)
        statuses = np.where(vals == 1.0, "CRITICAL", "HEALTHY")
    else:  # achievement %
        safe_fcs = np.where(fcs > 0, fcs, 1.0)
        vals = np.where(fcs > 0, np.round((sales / safe_fcs) * 100.0, 1), 0.0)
        
        statuses = np.full(len(df), "HEALTHY", dtype=object)
        statuses = np.where(fcs <= 0, "NEUTRAL", statuses)
        statuses = np.where((fcs > 0) & (vals < 70.0), "CRITICAL", statuses)
        statuses = np.where((fcs > 0) & (vals >= 100.0), "GOOD", statuses)
        statuses = np.where((fcs > 0) & (vals >= 120.0), "EXCELLENT", statuses)
        statuses = np.where((stocks <= 0.0001) & (fcs > sales) & (fcs > 0), "STOCKOUT_LIMITED", statuses)

    # Convert to cell dicts fast
    cells = [
        {"store": st, "code": cd, "value": v, "status": s}
        for st, cd, v, s in zip(stores_arr, codes_arr, vals, statuses)
    ]

    return ProductStoreMatrix(
        stores=stores,
        products=products,
        metric=metric,
        cells=cells
    )

def build_opportunity_risk_matrix(fact_df: pd.DataFrame, settings: AppSettings) -> Dict[str, Any]:
    """Generates 2x2 Opportunity / Risk Matrix."""
    if fact_df.empty:
        return {}

    q1 = [] # HIGH ACHIEVEMENT + LOW STOCK -> HIGH DEMAND / STOCKOUT RISK
    q2 = [] # HIGH ACHIEVEMENT + HIGH STOCK -> STRONG PERFORMANCE
    q3 = [] # LOW ACHIEVEMENT + HIGH STOCK -> EXCESS STOCK RISK
    q4 = [] # LOW ACHIEVEMENT + LOW STOCK -> INVESTIGATE

    for _, row in fact_df.iterrows():
        st = str(row['STORE'])
        cd = str(row['CODE'])
        nm = str(row['NAME'])
        fc = float(row['FC'])
        sale = float(row['SALE'])
        stock = float(row['FINAL_STOCK'])
        ach = (sale / fc * 100.0) if fc > 0 else 0.0

        item_info = {
            "store": st,
            "code": cd,
            "name": nm,
            "fc": fc,
            "sale": sale,
            "stock": stock,
            "achievement_pct": round(ach, 1)
        }

        if ach >= settings.achievement_target:
            if stock <= settings.low_stock_threshold:
                q1.append(item_info)
            else:
                q2.append(item_info)
        else:
            if stock >= settings.high_stock_threshold or (ach < settings.achievement_critical and stock > 20):
                q3.append(item_info)
            else:
                q4.append(item_info)

    return {
        "Q1_HIGH_DEMAND_STOCKOUT_RISK": {
            "label_az": "Yüksək Tələb / Stokout Riski (Yüksək Reallaşma + Aşağı Stok)",
            "count": len(q1),
            "items": q1[:30]
        },
        "Q2_STRONG_PERFORMANCE": {
            "label_az": "Güclü Performans (Yüksək Reallaşma + Kafi Stok)",
            "count": len(q2),
            "items": q2[:30]
        },
        "Q3_EXCESS_STOCK_RISK": {
            "label_az": "Artıq Stok Riski (Aşağı Reallaşma + Yüksək Stok)",
            "count": len(q3),
            "items": q3[:30]
        },
        "Q4_INVESTIGATE": {
            "label_az": "Aşağı Performans / Araşdırılmalı (Aşağı Reallaşma + Aşağı Stok)",
            "count": len(q4),
            "items": q4[:30]
        }
    }
