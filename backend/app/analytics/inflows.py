import math
import logging
import pandas as pd
from typing import List, Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)

def is_invalid_num(val: Any) -> bool:
    if val is None or pd.isna(val):
        return True
    try:
        f = float(val)
        return math.isnan(f) or math.isinf(f)
    except (ValueError, TypeError):
        return True

def compute_inflows(stocks: List[Optional[float]]) -> Tuple[List[Optional[float]], float]:
    """
    Computes daily stock inflows and total inflows from a chronological stock series.
    """
    daily_inflows: List[Optional[float]] = []
    prev: Optional[float] = None
    
    for stock in stocks:
        if is_invalid_num(stock):
            daily_inflows.append(None)
        else:
            stk_flt = float(stock)
            if prev is not None:
                if stk_flt > prev:
                    inflow = round(stk_flt - prev, 2)
                else:
                    inflow = 0.0
            else:
                inflow = None
            prev = stk_flt
            daily_inflows.append(inflow)
            
    total = sum(i for i in daily_inflows if i is not None)
    return daily_inflows, round(total, 2)

def compute_sales_adjusted_inflows(
    stocks: List[Optional[float]], 
    sales: List[float]
) -> Tuple[List[Optional[float]], float]:
    """
    Computes sales-adjusted inflows for comparison logging:
    per day inflow = max(0, stock_t - stock_(t-1) + sales_t)
    """
    daily_inflows: List[Optional[float]] = []
    prev: Optional[float] = None
    
    for idx, stock in enumerate(stocks):
        sale = sales[idx] if idx < len(sales) else 0.0
        sale_flt = float(sale) if not is_invalid_num(sale) else 0.0
        if is_invalid_num(stock):
            daily_inflows.append(None)
        else:
            stk_flt = float(stock)
            if prev is not None:
                adj_diff = stk_flt - prev + sale_flt
                inflow = max(0.0, round(adj_diff, 2))
            else:
                inflow = None
            prev = stk_flt
            daily_inflows.append(inflow)
            
    total = sum(i for i in daily_inflows if i is not None)
    return daily_inflows, round(total, 2)

def compute_over_stock(
    inflow: Optional[float],
    sale: Optional[float],
    last_stock: Optional[float] = None,
    ref: Optional[float] = None,
    regular_30d: Optional[float] = 0.0
) -> Optional[float]:
    """
    Computes Over Stock: max(0, inflow - sale - ref - regular_30d).
    Son stok (last_stock) nəzərə alınmır.
    Returns None if ref, inflow, sale, or regular_30d is invalid/None.
    """
    if is_invalid_num(ref) or is_invalid_num(inflow) or is_invalid_num(sale) or is_invalid_num(regular_30d):
        return None
        
    unsold_inflow = max(0.0, float(inflow) - float(sale))
    over_stock = max(0.0, unsold_inflow - float(ref) - float(regular_30d))
    return round(over_stock, 2)

def compute_over_stock_breakdown(
    inflow: Optional[float],
    sale: Optional[float] = None,
    last_stock: Optional[float] = None,
    ref: Optional[float] = None,
    regular_30d: Optional[float] = 0.0
) -> Dict[str, Optional[float]]:
    """
    Returns breakdown dict for tooltips and detailed analysis:
    {unsold_inflow, ref, regular_30d, over_stock}
    """
    inflow_invalid = is_invalid_num(inflow)
    sale_invalid = is_invalid_num(sale)
    ref_invalid = is_invalid_num(ref)
    regular_invalid = is_invalid_num(regular_30d)

    unsold_inflow = max(0.0, float(inflow) - float(sale)) if not (inflow_invalid or sale_invalid) else None
    ref_val = float(ref) if not ref_invalid else None
    reg_val = float(regular_30d) if not regular_invalid else None

    if unsold_inflow is None or ref_val is None or reg_val is None:
        over_stock_val = None
    else:
        over_stock_val = max(0.0, round(unsold_inflow - ref_val - reg_val, 2))

    return {
        "unsold_inflow": round(unsold_inflow, 2) if unsold_inflow is not None else None,
        "ref": round(ref_val, 2) if ref_val is not None else None,
        "regular_30d": round(reg_val, 2) if reg_val is not None else None,
        "over_stock": over_stock_val
    }

def compute_over_stock_base(
    inflow: Optional[float],
    sale: Optional[float],
    last_stock: Optional[float] = None
) -> Optional[float]:
    """
    Computes Over Stock Base (max(0, inflow - sale)).
    """
    if is_invalid_num(inflow) or is_invalid_num(sale):
        return None
    unsold_inflow = max(0.0, float(inflow) - float(sale))
    return round(unsold_inflow, 2)




