import math
from datetime import date, timedelta, datetime
from typing import Dict, Any, List, Optional, Tuple
from app.db import get_db_connection
from app.distribution.sql_engine import query_sales_history_and_forecast, query_yoy_sales_history

def calculate_forecast_accuracy_metrics(
    pairs: List[Tuple[float, float]],
    min_data_points: int = 5
) -> Dict[str, Any]:
    """
    Computes WAPE, Forecast Bias %, MAE, and RMSE strictly on verified test data.
    Rule 15: If total actual sales is 0 or test data points < min_data_points,
    gracefully returns INSUFFICIENT_DATA to avoid misleading artificial precision.
    
    pairs: List of (actual_qty, forecast_qty)
    """
    if not pairs or len(pairs) < min_data_points:
        return {
            "status": "INSUFFICIENT_DATA",
            "message": f"Kifayət qədər test məlumatı yoxdur (Mövcud: {len(pairs) if pairs else 0}, Tələb olunan minimum: {min_data_points}).",
            "sample_size": len(pairs) if pairs else 0,
            "wape_pct": None,
            "bias_pct": None,
            "mae": None,
            "total_actual": 0.0,
            "total_forecast": 0.0
        }

    total_actual = sum(p[0] for p in pairs)
    total_forecast = sum(p[1] for p in pairs)

    if total_actual <= 0.0:
        return {
            "status": "INSUFFICIENT_DATA",
            "message": "Test dövründə faktiki satış 0 olduğu üçün WAPE və Bias hesablanmadı.",
            "sample_size": len(pairs),
            "wape_pct": None,
            "bias_pct": None,
            "mae": None,
            "total_actual": 0.0,
            "total_forecast": round(total_forecast, 2)
        }

    sum_abs_error = sum(abs(p[0] - p[1]) for p in pairs)
    sum_signed_error = sum(p[1] - p[0] for p in pairs)
    sum_sq_error = sum((p[0] - p[1]) ** 2 for p in pairs)
    n = float(len(pairs))

    wape = round((sum_abs_error / total_actual) * 100.0, 2)
    bias = round((sum_signed_error / total_actual) * 100.0, 2)
    mae = round(sum_abs_error / n, 2)
    rmse = round(math.sqrt(sum_sq_error / n), 2)

    return {
        "status": "VALID",
        "sample_size": len(pairs),
        "total_actual": round(total_actual, 2),
        "total_forecast": round(total_forecast, 2),
        "wape_pct": wape,
        "bias_pct": bias,
        "mae": mae,
        "rmse": rmse
    }

def run_forecast_backtest(
    product_codes: List[str],
    store_codes: Optional[List[str]] = None,
    test_start_date: Optional[date] = None,
    duration_days: int = 7,
    history_days: int = 30,
    yoy_weight: float = 0.30,
    min_data_points: int = 5
) -> Dict[str, Any]:
    """
    Backtests forecast methods against verified actual sales from SQL Server.
    
    Workflow:
    1. Selects a completed historical test window [test_start, test_start + duration_days - 1].
       (Defaults to 14 days ago so full actual sales are complete in DB).
    2. Queries pre-period history (30 calendar days before test_start) to simulate forecast.
    3. Queries YoY history (364 days back) from dbo.fnc_TS_SALES_REPORT_FOR_PLANNING_UNION.
    4. Queries ground-truth actual sales during the test window from fnc_TS_SALES_REPORT_FOR_PLANNING.
    5. Computes side-by-side WAPE and Forecast Bias % for:
       - Current Trend Only
       - Blended Trend + YoY
    6. Returns INSUFFICIENT_DATA if test volume is insufficient to prevent fake precision.
    """
    clean_skus = list(set(str(c).strip() for c in product_codes if c and str(c).strip()))
    if not clean_skus:
        return {"status": "ERROR", "message": "Məhsul kodları boşdur."}

    # If test_start_date not provided, choose a safe window 14 days ago
    if test_start_date is None:
        test_start_date = date.today() - timedelta(days=duration_days + 7)

    test_end_date = test_start_date + timedelta(days=duration_days - 1)
    test_start_str = test_start_date.strftime("%Y-%m-%d")
    test_end_str = test_end_date.strftime("%Y-%m-%d")

    # 1. Fetch pre-test baseline sales (Safe 30 calendar days)
    trend_map, net_avgs = query_sales_history_and_forecast(
        product_codes=clean_skus,
        store_codes=store_codes or [],
        campaign_start=test_start_date,
        duration_days=duration_days,
        history_days=history_days,
        stockout_correction=False,
        promo_uplift_pct=0.0,
        stockout_history_available=False
    )

    # 2. Fetch YoY history (364 days back from test_start)
    yoy_sales_map, _ = query_yoy_sales_history(
        product_codes=clean_skus,
        store_codes=store_codes,
        campaign_start=test_start_date,
        duration_days=duration_days,
        yoy_years_back=1
    )

    # 3. Query Ground Truth Actual Sales during the test window
    conn = get_db_connection()
    cursor = conn.cursor()

    actual_sales_map: Dict[Tuple[str, str], float] = {}
    batch_size = 500

    try:
        for i in range(0, len(clean_skus), batch_size):
            sku_batch = clean_skus[i:i + batch_size]
            placeholders = ",".join(["?"] * len(sku_batch))

            sql = f"""
            SELECT 
                LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))) AS store_code,
                LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50)))) AS item_code,
                SUM(CAST(ISNULL(MIQDARI, 0) AS FLOAT)) as actual_sales_qty
            FROM fnc_TS_SALES_REPORT_FOR_PLANNING('{test_start_str}', '{test_end_str}')
            WHERE LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50)))) IN ({placeholders})
            GROUP BY LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))), LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50))))
            """
            cursor.execute(sql, sku_batch)
            for row in cursor.fetchall():
                st = str(row[0]).strip()
                sku = str(row[1]).strip()
                if store_codes and st not in store_codes:
                    continue
                actual_sales_map[(st, sku)] = max(0.0, float(row[2]) if row[2] is not None else 0.0)
    except Exception as e:
        return {"status": "ERROR", "message": f"Faktiki satış sorğulanarkən xəta baş verdi: {str(e)}"}
    finally:
        cursor.close()
        conn.close()

    # 4. Compile paired test results
    all_keys = set(trend_map.keys()) | set(actual_sales_map.keys()) | set(yoy_sales_map.keys())

    pairs_trend_only: List[Tuple[float, float]] = []
    pairs_blended: List[Tuple[float, float]] = []

    w = max(0.0, min(1.0, float(yoy_weight)))

    for k in all_keys:
        act = actual_sales_map.get(k, 0.0)
        tr = trend_map.get(k, 0.0)
        yoy = yoy_sales_map.get(k, 0.0)

        # Only evaluate where either actual or pre-trend had activity
        if act > 0 or tr > 0:
            pairs_trend_only.append((act, tr))

            if yoy > 0:
                blended = ((1.0 - w) * tr) + (w * yoy) if tr > 0 else yoy
            else:
                blended = tr
            pairs_blended.append((act, blended))

    trend_metrics = calculate_forecast_accuracy_metrics(pairs_trend_only, min_data_points=min_data_points)
    blended_metrics = calculate_forecast_accuracy_metrics(pairs_blended, min_data_points=min_data_points)

    return {
        "status": "COMPLETED",
        "test_period": {
            "start_date": test_start_str,
            "end_date": test_end_str,
            "duration_days": duration_days
        },
        "skus_tested": len(clean_skus),
        "total_store_sku_pairs": len(all_keys),
        "results": {
            "current_trend_only": trend_metrics,
            "blended_trend_yoy": blended_metrics
        },
        "evaluation_note": (
            "WAPE və Forecast Bias yalnız real tarixi satış qeydə alındıqda hesablanır. "
            "Sıfır faktiki satış dövrlərində süni dəqiqlik nümayiş etdirilmir."
        )
    }
