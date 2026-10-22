import numpy as np
import pandas as pd
from typing import Dict, Tuple, Any
from app.schemas import AppSettings

def classify_health_score(score: float) -> str:
    if score >= 80.0:
        return "Excellent"
    elif score >= 60.0:
        return "Good"
    elif score >= 40.0:
        return "Weak"
    else:
        return "Critical"

def calculate_promo_health_score(fact_df: pd.DataFrame, settings: AppSettings) -> Tuple[float, str]:
    """Calculates overall campaign promo health score (0-100)."""
    if fact_df.empty:
        return 0.0, "Critical"

    total_fc = float(fact_df['FC'].sum())
    total_sale = float(fact_df['SALE'].sum())
    total_stock = float(fact_df['FINAL_STOCK'].sum())
    
    ach_component = min((total_sale / total_fc) * 100.0, 100.0) if total_fc > 0 else 0.0
    denom = total_sale + total_stock
    st_component = (total_sale / denom) * 100.0 if denom > 0 else 0.0
    
    stockout_count = (fact_df['FINAL_STOCK'] <= 0.0001).sum()
    stockout_pct = (stockout_count / len(fact_df)) * 100.0 if len(fact_df) > 0 else 0.0
    stockout_component = max(100.0 - stockout_pct, 0.0)
    
    # Error penalty based on WAPE
    wape = (fact_df['SALE'] - fact_df['FC']).abs().sum() / total_fc * 100.0 if total_fc > 0 else 0.0
    bias_component = max(100.0 - wape, 0.0)
    
    score = (
        ach_component * settings.weight_achievement +
        st_component * settings.weight_sell_through +
        stockout_component * settings.weight_stockout +
        bias_component * settings.weight_bias
    )
    
    final_score = round(float(np.clip(score, 0.0, 100.0)), 1)
    return final_score, classify_health_score(final_score)

def calculate_store_health_score(store_fc: float, store_sale: float, store_stock: float, stockout_pct: float, settings: AppSettings) -> Tuple[float, str]:
    ach_component = min((store_sale / store_fc) * 100.0, 100.0) if store_fc > 0 else 0.0
    denom = store_sale + store_stock
    st_component = (store_sale / denom) * 100.0 if denom > 0 else 0.0
    stockout_component = max(100.0 - stockout_pct, 0.0)
    
    err = abs(store_sale - store_fc) / store_fc * 100.0 if store_fc > 0 else 0.0
    bias_component = max(100.0 - err, 0.0)
    
    score = (
        ach_component * settings.weight_achievement +
        st_component * settings.weight_sell_through +
        stockout_component * settings.weight_stockout +
        bias_component * settings.weight_bias
    )
    final_score = round(float(np.clip(score, 0.0, 100.0)), 1)
    return final_score, classify_health_score(final_score)

def calculate_product_health_score(prod_fc: float, prod_sale: float, prod_stock: float, stockout_pct: float, settings: AppSettings) -> Tuple[float, str]:
    ach_component = min((prod_sale / prod_fc) * 100.0, 100.0) if prod_fc > 0 else 0.0
    denom = prod_sale + prod_stock
    st_component = (prod_sale / denom) * 100.0 if denom > 0 else 0.0
    stockout_component = max(100.0 - stockout_pct, 0.0)
    
    err = abs(prod_sale - prod_fc) / prod_fc * 100.0 if prod_fc > 0 else 0.0
    bias_component = max(100.0 - err, 0.0)
    
    score = (
        ach_component * settings.weight_achievement +
        st_component * settings.weight_sell_through +
        stockout_component * settings.weight_stockout +
        bias_component * settings.weight_bias
    )
    final_score = round(float(np.clip(score, 0.0, 100.0)), 1)
    return final_score, classify_health_score(final_score)
