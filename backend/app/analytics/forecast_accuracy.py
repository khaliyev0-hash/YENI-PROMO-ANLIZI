import numpy as np
import pandas as pd
from typing import Dict, Any
from app.schemas import ForecastAccuracyMetrics

def calculate_forecast_accuracy(fact_df: pd.DataFrame) -> ForecastAccuracyMetrics:
    """
    Calculates supply chain forecast accuracy metrics:
    WAPE, MAE, RMSE, Bias, MAPE, Achievement %.
    """
    if fact_df.empty:
        return ForecastAccuracyMetrics(
            wape=0.0,
            mae=0.0,
            rmse=0.0,
            bias=0.0,
            mape=None,
            achievement_pct=None,
            description_az="Məlumat yoxdur.",
            description_en="No data available."
        )

    fc_series = pd.to_numeric(fact_df['FC'], errors='coerce').fillna(0.0)
    sale_series = pd.to_numeric(fact_df['SALE'], errors='coerce').fillna(0.0)
    fc_array = fc_series.to_numpy(dtype=float)
    sale_array = sale_series.to_numpy(dtype=float)
    
    total_fc = float(np.sum(fc_array))
    total_sale = float(np.sum(sale_array))
    errors = sale_array - fc_array
    abs_errors = np.abs(errors)
    
    # 1. WAPE = SUM(|SALE - FC|) / SUM(FC) * 100
    wape = float((np.sum(abs_errors) / total_fc) * 100.0) if total_fc > 0 else 0.0
    
    # 2. MAE = MEAN(|SALE - FC|)
    mae = float(np.mean(abs_errors)) if len(abs_errors) > 0 else 0.0
    mae = 0.0 if np.isnan(mae) else mae
    
    # 3. RMSE = SQRT(MEAN((SALE - FC)^2))
    rmse = float(np.sqrt(np.mean(errors ** 2))) if len(errors) > 0 else 0.0
    rmse = 0.0 if np.isnan(rmse) else rmse
    
    # 4. Bias = SUM(SALE - FC)
    bias = float(np.sum(errors))
    bias = 0.0 if np.isnan(bias) else bias
    
    # 5. MAPE = MEAN(|SALE - FC| / FC) * 100 where FC > 0
    valid_fc_mask = fc_array > 0
    if np.any(valid_fc_mask):
        mape = float(np.mean(abs_errors[valid_fc_mask] / fc_array[valid_fc_mask]) * 100.0)
    else:
        mape = None
        
    # 6. Achievement %
    achievement_pct = float((total_sale / total_fc) * 100.0) if total_fc > 0 else None

    bias_status_az = "müsbət (tələb proqnozu üstələyib)" if bias > 0 else "mənfi (aşırı proqnoz verilib)"
    
    desc_az = f"WAPE göstəricisi: {round(wape, 2)}%. WAPE aşağı olduqca proqnoz dəqiqliyi yüksəkdir. Ümumi Bias: {round(bias, 2)} unit — {bias_status_az}."
    desc_en = f"WAPE: {round(wape, 2)}%. Lower WAPE indicates higher forecast accuracy. Overall Bias: {round(bias, 2)} units."

    return ForecastAccuracyMetrics(
        wape=round(wape, 2),
        mae=round(mae, 2),
        rmse=round(rmse, 2),
        bias=round(bias, 2),
        mape=round(mape, 2) if mape is not None else None,
        achievement_pct=round(achievement_pct, 2) if achievement_pct is not None else None,
        description_az=desc_az,
        description_en=desc_en
    )
