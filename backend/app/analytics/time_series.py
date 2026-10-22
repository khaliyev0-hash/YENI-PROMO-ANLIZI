import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from app.schemas import DailyStockSummary

def calculate_time_series_metrics(timeline_df: pd.DataFrame) -> Tuple[List[DailyStockSummary], Dict[str, Any]]:
    """
    Computes daily summary trends and item-level time series metrics.
    """
    if timeline_df is None or timeline_df.empty:
        return [], {}

    # Unique dates sorted chronologically
    dates = sorted(timeline_df['STOCK_DATE'].unique().tolist())
    daily_summaries: List[DailyStockSummary] = []

    if len(dates) <= 1:
        # Single snapshot date
        single_date = dates[0] if dates else ""
        sub = timeline_df[timeline_df['STOCK_DATE'] == single_date]
        total_stock = float(sub['STOCK_QTY'].sum())
        stockouts = int((sub['STOCK_QTY'] <= 0.0001).sum())
        active = int((sub['STOCK_QTY'] > 0.0001).sum())
        
        daily_summaries.append(DailyStockSummary(
            date=single_date,
            opening_stock=total_stock,
            closing_stock=total_stock,
            depletion=0.0,
            stockout_count=stockouts,
            active_products=active,
            at_risk_products=int((sub['STOCK_QTY'] < 5.0).sum())
        ))
        return daily_summaries, {
            "has_time_series": False,
            "dates": dates,
            "total_days": 1
        }

    # Multiple dates: Compute daily stock movement
    pivot_df = timeline_df.pivot_table(index=['STORE', 'CODE'], columns='STOCK_DATE', values='STOCK_QTY', aggfunc='last').fillna(0.0)
    
    prev_date = None
    for date in dates:
        current_stocks = pivot_df[date]
        total_closing = float(current_stocks.sum())
        
        if prev_date is not None:
            prev_stocks = pivot_df[prev_date]
            total_opening = float(prev_stocks.sum())
            # Depletion is decrease in stock
            depletion = max(total_opening - total_closing, 0.0)
        else:
            total_opening = total_closing
            depletion = 0.0
            
        stockout_cnt = int((current_stocks <= 0.0001).sum())
        active_cnt = int((current_stocks > 0.0001).sum())
        at_risk_cnt = int(((current_stocks > 0.0001) & (current_stocks < 5.0)).sum())
        
        daily_summaries.append(DailyStockSummary(
            date=date,
            opening_stock=round(total_opening, 2),
            closing_stock=round(total_closing, 2),
            depletion=round(depletion, 2),
            stockout_count=stockout_cnt,
            active_products=active_cnt,
            at_risk_products=at_risk_cnt
        ))
        prev_date = date

    return daily_summaries, {
        "has_time_series": True,
        "dates": dates,
        "total_days": len(dates)
    }

def get_item_stock_movement(timeline_df: pd.DataFrame, store: str, code: str) -> Dict[str, Any]:
    """Retrieves chronological daily stock history for a specific STORE + CODE."""
    sub = timeline_df[(timeline_df['STORE'] == store) & (timeline_df['CODE'] == code)].sort_values('STOCK_DATE')
    if sub.empty:
        return {
            "dates": [],
            "stocks": [],
            "depletions": [],
            "opening": 0.0,
            "closing": 0.0,
            "min_stock": 0.0,
            "max_stock": 0.0,
            "avg_stock": 0.0,
            "stockout_days": 0,
            "first_stockout_date": None
        }

    dates = sub['STOCK_DATE'].tolist()
    stocks = sub['STOCK_QTY'].tolist()
    depletions = [0.0]
    for i in range(1, len(stocks)):
        dep = max(stocks[i-1] - stocks[i], 0.0)
        depletions.append(round(dep, 2))
        
    stockout_dates = sub[sub['STOCK_QTY'] <= 0.0001]['STOCK_DATE'].tolist()
    
    return {
        "dates": dates,
        "stocks": stocks,
        "depletions": depletions,
        "opening": stocks[0],
        "closing": stocks[-1],
        "min_stock": min(stocks),
        "max_stock": max(stocks),
        "avg_stock": round(float(np.mean(stocks)), 2),
        "stockout_days": len(stockout_dates),
        "first_stockout_date": stockout_dates[0] if stockout_dates else None
    }


def calculate_daily_sales_series(
    db_df: Optional[pd.DataFrame],
    fact_df: pd.DataFrame,
    beg_date: Optional[str],
    end_date: Optional[str],
    total_fc: float,
    total_fc_azn: float = 0.0,
    as_of_date: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    Builds the genuine real daily sales series for the campaign:
    - Matches only real DB rows over the SAME active store/product pairs present in fact_df.
    - Rows with negative sales are clipped to 0.0 to reconcile with fact_df row-level SALE.
    - Dates are generated across the full campaign range [beg_date, end_date].
    - Days up to the latest available sale_date have real sales and running cumulative sum.
    - Days after the latest available sale_date are set to None (no synthetic split).
    - If latest available date equals today (or extraction date), flagged with partial=True.
    - If db_df is missing or empty, returns None (older archives without it trigger empty state).
    """
    if db_df is None or db_df.empty or 'sale_date' not in db_df.columns:
        return None
    if fact_df is None or fact_df.empty or not beg_date or not end_date:
        return None

    # 1. Extract valid (store, code) pairs from fact_df (which already passed store filter)
    from app.db import normalize_store_code, normalize_item_code

    fact_pairs = set(zip(
        fact_df['STORE'].astype(str).map(lambda s: normalize_store_code(s) or s),
        fact_df['CODE'].astype(str).map(lambda c: normalize_item_code(c) or c)
    ))
    if not fact_pairs:
        return None

    # 2. Filter db_df to matched pairs
    df_db_copy = db_df.copy()
    norm_st = df_db_copy['store_code'].astype(str).map(lambda s: normalize_store_code(s) or s)
    norm_cd = df_db_copy['item_code'].astype(str).map(lambda c: normalize_item_code(c) or c)

    pair_tuples = list(zip(norm_st, norm_cd))
    mask = [p in fact_pairs for p in pair_tuples]
    matched = df_db_copy[mask].copy()
    if matched.empty:
        return None

    matched['sale_date_clean'] = matched['sale_date'].astype(str).str[:10]
    matched['sales_qty'] = pd.to_numeric(matched['sales_qty'], errors='coerce').fillna(0.0).clip(lower=0.0)
    matched['sales_amount'] = pd.to_numeric(matched.get('sales_amount', 0.0), errors='coerce').fillna(0.0).clip(lower=0.0)

    # 3. Aggregate by clean sale_date
    daily_grp = matched.groupby('sale_date_clean').agg(
        qty=('sales_qty', 'sum'),
        amount=('sales_amount', 'sum')
    ).to_dict(orient='index')

    available_dates = sorted([d for d in daily_grp.keys() if beg_date <= d <= end_date])
    if not available_dates:
        return None
    latest_available_date = max(available_dates)

    # 4. Generate full campaign date list
    try:
        campaign_dates = [d.strftime("%Y-%m-%d") for d in pd.date_range(beg_date, end_date)]
    except Exception:
        campaign_dates = available_dates

    N = max(len(campaign_dates), 1)
    today_str = as_of_date or datetime.now().strftime("%Y-%m-%d")

    running_cum_qty = 0.0
    running_cum_amount = 0.0
    series = []

    for i, d_str in enumerate(campaign_dates, start=1):
        ideal_pct = round((i / N) * 100.0, 2)
        if d_str <= latest_available_date:
            day_data = daily_grp.get(d_str, {'qty': 0.0, 'amount': 0.0})
            day_qty = float(day_data['qty'])
            day_amt = float(day_data['amount'])

            running_cum_qty += day_qty
            running_cum_amount += day_amt

            d_pct = round((day_qty / total_fc * 100.0), 2) if total_fc > 0 else 0.0
            d_amt_pct = round((day_amt / total_fc_azn * 100.0), 2) if total_fc_azn > 0 else 0.0

            cum_pct = round((running_cum_qty / total_fc * 100.0), 2) if total_fc > 0 else 0.0
            cum_amt_pct = round((running_cum_amount / total_fc_azn * 100.0), 2) if total_fc_azn > 0 else 0.0

            is_partial = (d_str == today_str and d_str == latest_available_date)

            series.append({
                "day": i,
                "date": d_str,
                "daily_sale": round(day_qty, 2),
                "daily_amount": round(day_amt, 2),
                "daily_pct": d_pct,
                "daily_amount_pct": d_amt_pct,
                "cumulative_pct": cum_pct,
                "cumulative_amount_pct": cum_amt_pct,
                "ideal_pct": ideal_pct,
                "partial": is_partial,
                "is_future": False
            })
        else:
            series.append({
                "day": i,
                "date": d_str,
                "daily_sale": None,
                "daily_amount": None,
                "daily_pct": None,
                "daily_amount_pct": None,
                "cumulative_pct": None,
                "cumulative_amount_pct": None,
                "ideal_pct": ideal_pct,
                "partial": False,
                "is_future": True
            })

    return series
