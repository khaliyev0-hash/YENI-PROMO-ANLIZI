import pandas as pd
import numpy as np
from typing import Dict, List, Any
from app.schemas import AppSettings

def analyze_stockouts_and_lost_sales(fact_df: pd.DataFrame, timeline_df: pd.DataFrame, settings: AppSettings) -> Dict[str, Any]:
    """
    Analyzes store stockout rates, classifies stockout vs forecast reasons,
    and estimates potential lost sales. Vectorized implementation for maximum performance.
    """
    if fact_df.empty:
        return {
            "stockout_classification": {},
            "estimated_lost_sales_by_product": {},
            "overall_estimated_lost_units": 0.0
        }

    # 1. Stockout vs Forecast classification count (vectorized)
    fc_series = fact_df['FC'].fillna(0.0)
    sale_series = fact_df['SALE'].fillna(0.0)
    stock_series = fact_df['FINAL_STOCK'].fillna(0.0)
    is_stockout = stock_series <= 0.0001
    fc_gt_sale = fc_series > sale_series

    stockout_limited_cnt = int((is_stockout & fc_gt_sale).sum())
    crit_thresh = (settings.achievement_critical / 100.0)
    non_zero_fc = fc_series.replace(0, np.nan)
    ach_series = (sale_series / non_zero_fc)
    forecast_overestimation_cnt = int(((stock_series > 0) & fc_gt_sale & (ach_series < crit_thresh)).sum())
    over_performing_cnt = int(((sale_series >= fc_series) & (fc_series > 0)).sum())
    healthy_cnt = len(fact_df) - (stockout_limited_cnt + forecast_overestimation_cnt + over_performing_cnt)

    classification_summary = {
        "stockout_limited_sales": stockout_limited_cnt,
        "forecast_overestimation": forecast_overestimation_cnt,
        "healthy_performance": healthy_cnt,
        "over_performing": over_performing_cnt
    }

    # 2. Estimate Lost Sales per Product (vectorized)
    has_timeline = timeline_df is not None and not timeline_df.empty and 'STOCK_DATE' in timeline_df.columns and timeline_df['STOCK_DATE'].nunique() > 1
    cand_mask = is_stockout & fc_gt_sale
    cands = fact_df[cand_mask].copy()

    if cands.empty:
        product_lost_sales = {str(code): 0.0 for code in fact_df['CODE'].unique()}
        overall_lost_units = 0.0
    elif has_timeline:
        tl_work = timeline_df.copy()
        tl_work['is_so'] = (tl_work['STOCK_QTY'] <= 0.0001).astype(int)
        tl_work = tl_work.sort_values('STOCK_DATE')
        ts_stats = tl_work.groupby(['STORE', 'CODE'], as_index=False).agg(
            total_days=('STOCK_DATE', 'count'),
            stockout_days=('is_so', 'sum'),
            opening_stock=('STOCK_QTY', 'first')
        )
        
        cand_merged = cands.merge(ts_stats, on=['STORE', 'CODE'], how='left')
        cand_merged['total_days'] = cand_merged['total_days'].fillna(0)
        cand_merged['stockout_days'] = cand_merged['stockout_days'].fillna(0)
        cand_merged['opening_stock'] = cand_merged['opening_stock'].fillna(0.0)
        
        active_days = cand_merged['total_days'] - cand_merged['stockout_days']
        valid_mask = (active_days > 0) & (cand_merged['stockout_days'] > 0)
        
        # Calculate daily sales velocity during in-stock days
        sales_velocity = cand_merged['SALE'] / np.maximum(active_days, 1)
        est_lost = np.where(
            valid_mask,
            sales_velocity * cand_merged['stockout_days'],
            (cand_merged['FC'] - cand_merged['SALE']).clip(lower=0.0)
        )
        cand_merged['est_lost'] = est_lost
        lost_by_code = cand_merged.groupby('CODE')['est_lost'].sum().round(2).to_dict()
        product_lost_sales = {str(code): round(float(lost_by_code.get(code, 0.0)), 2) for code in fact_df['CODE'].unique()}
        overall_lost_units = float(sum(lost_by_code.values()))
    else:
        cands['est_lost'] = (cands['FC'] - cands['SALE']).clip(lower=0.0)
        lost_by_code = cands.groupby('CODE')['est_lost'].sum().round(2).to_dict()
        product_lost_sales = {str(code): round(float(lost_by_code.get(code, 0.0)), 2) for code in fact_df['CODE'].unique()}
        overall_lost_units = float(sum(lost_by_code.values()))

    return {
        "stockout_classification": classification_summary,
        "estimated_lost_sales_by_product": product_lost_sales,
        "overall_estimated_lost_units": round(overall_lost_units, 2)
    }
