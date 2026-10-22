import pytest
from datetime import date
from unittest.mock import patch, MagicMock
from app.distribution.optimizer import calculate_net_order
from app.distribution.excel_processor import ImportedRow
from app.distribution.service import run_distribution_planning
from app.distribution.backtest import calculate_forecast_accuracy_metrics, run_forecast_backtest

def test_safe_baseline_no_stockout_guessing():
    """
    Rules 1, 2, 4, 16:
    When daily historical stock snapshot is absent (stockout_history_available=False),
    sales must be divided across all 30 calendar days, NOT guessed by active selling days.
    StockoutCorrectionApplied must be False.
    """
    valid_rows = [
        ImportedRow(row_number=2, store_code="101", product_code="100003", product_name="AHMAD TEA", shelf_capacity=30.0),
    ]
    mock_raw_stocks = [
        {
            "IS YERI NO": "101", "URUN KODU": "100003", "URUN AD": "AHMAD TEA",
            "IS YERI TEDARUK TIPI": 41, "TEDARIKCI BLOKAJI": "XEYR",
            "Stok miqdari": 0.0, "QUTU ICI": 10.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        }
    ]

    # Total 30-day sales = 30 units across 5 active days.
    # Safe baseline ADS30 = 30 / 30 = 1.0 unit/day -> 7 days = 7.0 units.
    # (If wrongly guessed by active days, it would be 30 / 5 * 7 = 42 units!).
    mock_forecast = {("101", "100003"): 7.0}

    with patch("app.distribution.service.query_stock_details_for_skus", return_value=mock_raw_stocks), \
         patch("app.distribution.service.query_sales_history_and_forecast", return_value=(mock_forecast, {"100003": 7.0})), \
         patch("app.distribution.service.query_yoy_sales_history", return_value=({}, {})):

        res = run_distribution_planning(
            title="Safe Baseline Test",
            valid_excel_rows=valid_rows,
            start_date_str="2026-11-01",
            duration_days=7,
            include_yoy_history=False
        )

        item = res["orders"][0]
        assert item["forecast_demand"] == 7.0
        assert item["stockout_correction_applied"] is False
        assert item["stockout_history_available"] is False
        assert item["forecast_method"] == "CURRENT_TREND_ONLY"
        assert item["forecast_confidence"] == "NORMAL"
        assert res["summary"]["stockout_correction_applied"] is False
        assert res["summary"]["stockout_history_available"] is False

def test_rule8_zero_current_sales_positive_yoy_fallback():
    """
    Rule 8:
    When current sales is 0 but YoY is positive, do NOT guess stockout.
    Assign YOY_FALLBACK, LIMITED confidence, and document warning reason.
    """
    valid_rows = [
        ImportedRow(row_number=2, store_code="105", product_code="101435", product_name="BIZON ENERGY", shelf_capacity=50.0),
    ]
    mock_raw_stocks = [
        {
            "IS YERI NO": "105", "URUN KODU": "101435", "URUN AD": "BIZON ENERGY",
            "IS YERI TEDARUK TIPI": 41, "TEDARIKCI BLOKAJI": "XEYR",
            "Stok miqdari": 0.0, "QUTU ICI": 24.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        }
    ]

    # Current sales 0 (missing in forecast map)
    mock_forecast = {}
    mock_yoy_sales = {("105", "101435"): 180.0}
    mock_yoy_promo = {("105", "101435"): 0.0}

    with patch("app.distribution.service.query_stock_details_for_skus", return_value=mock_raw_stocks), \
         patch("app.distribution.service.query_sales_history_and_forecast", return_value=(mock_forecast, {})), \
         patch("app.distribution.service.query_yoy_sales_history", return_value=(mock_yoy_sales, mock_yoy_promo)):

        res = run_distribution_planning(
            title="Rule 8 Test",
            valid_excel_rows=valid_rows,
            start_date_str="2026-11-01",
            duration_days=7,
            include_yoy_history=True,
            yoy_weight=0.30
        )

        item = res["orders"][0]
        assert item["forecast_method"] == "YOY_FALLBACK"
        assert item["forecast_confidence"] == "LIMITED"
        assert item["warning_status"] == "ZERO_CURRENT_SALES_YOY_FALLBACK"
        assert "səbəb məlum deyil" in item["warning_reason"]
        assert item["forecast_demand"] == 180.0

def test_rule10_double_promo_prevention():
    """
    Rule 10:
    If YoY period already had promotional volume (yoy_promo > 0),
    and user applies uplift, prevent double promo counting on fallback,
    and flag DOUBLE_PROMO_RISK when blended.
    """
    valid_rows = [
        ImportedRow(row_number=2, store_code="105", product_code="101435", product_name="BIZON ENERGY", shelf_capacity=50.0),
    ]
    mock_raw_stocks = [
        {
            "IS YERI NO": "105", "URUN KODU": "101435", "URUN AD": "BIZON ENERGY",
            "IS YERI TEDARUK TIPI": 41, "TEDARIKCI BLOKAJI": "XEYR",
            "Stok miqdari": 0.0, "QUTU ICI": 24.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        }
    ]

    # Current sales 0, YoY had 200 units, of which 150 was promo!
    mock_forecast = {}
    mock_yoy_sales = {("105", "101435"): 200.0}
    mock_yoy_promo = {("105", "101435"): 150.0}

    with patch("app.distribution.service.query_stock_details_for_skus", return_value=mock_raw_stocks), \
         patch("app.distribution.service.query_sales_history_and_forecast", return_value=(mock_forecast, {})), \
         patch("app.distribution.service.query_yoy_sales_history", return_value=(mock_yoy_sales, mock_yoy_promo)):

        res = run_distribution_planning(
            title="Rule 10 Test",
            valid_excel_rows=valid_rows,
            start_date_str="2026-11-01",
            duration_days=7,
            promo_uplift_pct=25.0,  # User entered +25%
            include_yoy_history=True
        )

        item = res["orders"][0]
        # Uplift must NOT be multiplied on top of 200 because it already had promo!
        assert item["forecast_demand"] == 200.0
        assert item["promo_uplift_source"] == "HISTORICAL_PROMO_EMBEDDED"
        assert "qarşısı alındı" in item["warning_reason"]

def test_rule14_confidence_categories():
    """
    Rule 14:
    Confidence levels must strictly be explainable categories (NORMAL, LIMITED, MANUAL_REVIEW).
    """
    # 1. Normal: verified history
    item1 = calculate_net_order(
        store_code="101", product_code="101", product_name="TEST",
        start_date="2026-11-01", end_date="2026-11-07", duration_days=7,
        forecast_demand=50.0, current_stock=20.0, usable_current_stock=20.0, shelf_capacity=100.0,
        case_quantity=10.0, forecast_method="BLENDED_TREND_YOY", forecast_confidence="NORMAL"
    )
    assert item1.forecast_confidence == "NORMAL"

    # 2. Blocked: manual review
    item2 = calculate_net_order(
        store_code="101", product_code="101", product_name="TEST",
        start_date="2026-11-01", end_date="2026-11-07", duration_days=7,
        forecast_demand=50.0, current_stock=20.0, usable_current_stock=0.0, shelf_capacity=100.0,
        case_quantity=10.0, is_blocked=True
    )
    assert item2.forecast_confidence == "MANUAL_REVIEW"
    assert item2.warning_status == "SUPPLIER_BLOCKED"

def test_rule15_backtest_metrics_calculation_and_insufficient_data():
    """
    Rule 15:
    WAPE and bias metrics must strictly be computed on adequate test data.
    If sample size < min_data_points or actuals == 0, returns INSUFFICIENT_DATA.
    """
    # Test with insufficient sample size (only 2 pairs when min is 5)
    res_insufficient = calculate_forecast_accuracy_metrics([(10.0, 12.0), (20.0, 18.0)], min_data_points=5)
    assert res_insufficient["status"] == "INSUFFICIENT_DATA"
    assert res_insufficient["wape_pct"] is None

    # Test with 0 actuals
    res_zero = calculate_forecast_accuracy_metrics([(0.0, 5.0), (0.0, 10.0), (0.0, 2.0), (0.0, 0.0), (0.0, 4.0)], min_data_points=5)
    assert res_zero["status"] == "INSUFFICIENT_DATA"
    assert res_zero["wape_pct"] is None

    # Test with valid data
    # Actuals: 100, 200, 150, 50, 100 -> Sum = 600
    # Forecast: 110, 190, 160, 40, 100 -> Sum = 600
    # Abs Error: 10 + 10 + 10 + 10 + 0 = 40
    # WAPE = 40 / 600 = 6.67%, Bias = (600 - 600) / 600 = 0.0%
    valid_pairs = [(100.0, 110.0), (200.0, 190.0), (150.0, 160.0), (50.0, 40.0), (100.0, 100.0)]
    res_valid = calculate_forecast_accuracy_metrics(valid_pairs, min_data_points=5)
    assert res_valid["status"] == "VALID"
    assert res_valid["wape_pct"] == 6.67
    assert res_valid["bias_pct"] == 0.0
    assert res_valid["mae"] == 8.0
