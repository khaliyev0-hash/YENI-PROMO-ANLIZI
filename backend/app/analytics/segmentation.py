import pandas as pd
import numpy as np
from typing import Dict, List, Any
from app.schemas import AppSettings

def perform_abc_analysis(fact_df: pd.DataFrame, settings: AppSettings) -> Dict[str, Any]:
    """Performs ABC classification based on total sales contribution."""
    if fact_df.empty:
        return {"classes": {}, "items": {}}

    prod_summary = fact_df.groupby('CODE', as_index=False).agg({
        'NAME': 'first',
        'SALE': 'sum',
        'FC': 'sum',
        'FINAL_STOCK': 'sum'
    }).sort_values('SALE', ascending=False)

    total_sales = float(prod_summary['SALE'].sum())
    if total_sales <= 0.0:
        # If no sales, assign C to all
        items_dict = {code: "C" for code in prod_summary['CODE']}
        return {
            "classes": {
                "A": {"count": 0, "sales": 0.0, "fc": float(prod_summary['FC'].sum()), "stock": float(prod_summary['FINAL_STOCK'].sum())},
                "B": {"count": 0, "sales": 0.0, "fc": 0.0, "stock": 0.0},
                "C": {"count": len(prod_summary), "sales": 0.0, "fc": float(prod_summary['FC'].sum()), "stock": float(prod_summary['FINAL_STOCK'].sum())}
            },
            "items": items_dict
        }

    prod_summary['cum_sale'] = prod_summary['SALE'].cumsum()
    prod_summary['cum_pct'] = (prod_summary['cum_sale'] / total_sales) * 100.0

    a_limit = settings.abc_a_percent
    b_limit = settings.abc_a_percent + settings.abc_b_percent

    items_dict = {}
    classes_summary = {
        "A": {"count": 0, "sales": 0.0, "fc": 0.0, "stock": 0.0},
        "B": {"count": 0, "sales": 0.0, "fc": 0.0, "stock": 0.0},
        "C": {"count": 0, "sales": 0.0, "fc": 0.0, "stock": 0.0}
    }

    for _, row in prod_summary.iterrows():
        code = str(row['CODE'])
        cum_pct = float(row['cum_pct'])
        sale_val = float(row['SALE'])
        fc_val = float(row['FC'])
        stock_val = float(row['FINAL_STOCK'])

        if cum_pct <= a_limit or classes_summary["A"]["count"] == 0:
            cls = "A"
        elif cum_pct <= b_limit:
            cls = "B"
        else:
            cls = "C"

        items_dict[code] = cls
        classes_summary[cls]["count"] += 1
        classes_summary[cls]["sales"] += round(sale_val, 2)
        classes_summary[cls]["fc"] += round(fc_val, 2)
        classes_summary[cls]["stock"] += round(stock_val, 2)

    return {
        "classes": classes_summary,
        "items": items_dict
    }

def perform_xyz_analysis(timeline_df: pd.DataFrame) -> Tuple[Dict[str, str], bool]:
    """
    Performs XYZ demand variability analysis based on stock depletion volatility.
    Returns (item_xyz_dict, is_sufficient_data).
    """
    if timeline_df is None or timeline_df.empty or timeline_df['STOCK_DATE'].nunique() < 3:
        # Insufficient historical dates: do not fabricate data
        return {}, False

    # Compute daily depletion per store+code
    pivot_df = timeline_df.pivot_table(index=['STORE', 'CODE'], columns='STOCK_DATE', values='STOCK_QTY', aggfunc='last').fillna(0.0)
    
    # Calculate daily depletions
    depletions_df = pivot_df.diff(axis=1).iloc[:, 1:].abs() # positive depletion
    
    # Aggregate per product code across stores
    product_depletions = depletions_df.groupby(level='CODE').sum()

    xyz_dict = {}
    for code, row in product_depletions.iterrows():
        arr = row.to_numpy(dtype=float)
        mean_val = np.mean(arr)
        std_val = np.std(arr)
        
        if mean_val > 0.0001:
            cv = std_val / mean_val
            if cv <= 0.25:
                cls = "X"
            elif cv <= 0.75:
                cls = "Y"
            else:
                cls = "Z"
        else:
            cls = "Z"
        xyz_dict[str(code)] = cls

    return xyz_dict, True

def generate_pareto_data(fact_df: pd.DataFrame) -> Dict[str, Any]:
    """Generates Pareto cumulative contribution curves for Products and Stores."""
    if fact_df.empty:
        return {"products": [], "stores": []}

    # 1. Product Pareto
    p_group = fact_df.groupby(['CODE', 'NAME'], as_index=False)['SALE'].sum().sort_values('SALE', ascending=False)
    p_total = float(p_group['SALE'].sum())
    p_records = []
    cum = 0.0
    for idx, row in p_group.iterrows():
        s = float(row['SALE'])
        cum += s
        pct = (cum / p_total * 100.0) if p_total > 0 else 0.0
        p_records.append({
            "code": str(row['CODE']),
            "name": str(row['NAME']),
            "sales": round(s, 2),
            "cum_pct": round(pct, 2)
        })

    # 2. Store Pareto
    s_group = fact_df.groupby('STORE', as_index=False)['SALE'].sum().sort_values('SALE', ascending=False)
    s_total = float(s_group['SALE'].sum())
    s_records = []
    cum = 0.0
    for idx, row in s_group.iterrows():
        s = float(row['SALE'])
        cum += s
        pct = (cum / s_total * 100.0) if s_total > 0 else 0.0
        s_records.append({
            "store": str(row['STORE']),
            "sales": round(s, 2),
            "cum_pct": round(pct, 2)
        })

    return {
        "products": p_records,
        "stores": s_records
    }

def analyze_forecast_bias(fact_df: pd.DataFrame) -> Dict[str, Any]:
    """Identifies over-forecasted and under-forecasted items and stores."""
    if fact_df.empty:
        return {"over_forecasted_products": [], "under_forecasted_products": []}

    p_group = fact_df.groupby(['CODE', 'NAME'], as_index=False).agg({'FC': 'sum', 'SALE': 'sum'})
    p_group['error'] = p_group['SALE'] - p_group['FC']
    
    over_fc = p_group[p_group['error'] < 0].sort_values('error').head(10) # FC > SALE
    under_fc = p_group[p_group['error'] > 0].sort_values('error', ascending=False).head(10) # SALE > FC
    
    return {
        "over_forecasted_products": over_fc.to_dict('records'),
        "under_forecasted_products": under_fc.to_dict('records')
    }
