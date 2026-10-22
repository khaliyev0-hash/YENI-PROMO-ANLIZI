import pytest
import pandas as pd
from datetime import datetime
from app.analytics.time_series import calculate_daily_sales_series
from app.main import ensure_complete_analytics_payload, process_analytics
from app.schemas import AppSettings

@pytest.fixture
def mock_fact_df():
    return pd.DataFrame([
        {"STORE": "101", "CODE": "SKU1", "FC": 1000.0, "FC_MEBLEG": 2500.0, "SALE": 350.0},
        {"STORE": "102", "CODE": "SKU2", "FC": 1000.0, "FC_MEBLEG": 2500.0, "SALE": 150.0},
    ])

@pytest.fixture
def mock_db_sales():
    # 5-day campaign (2026-10-01 to 2026-10-05), but sales only on Day 1 and Day 2 (uneven values)
    return pd.DataFrame([
        # Day 1: 300 units on SKU1, 50 on SKU2 = 350 total
        {"store_code": "101", "item_code": "SKU1", "sale_date": "2026-10-01", "sales_qty": 300.0, "sales_amount": 750.0},
        {"store_code": "102", "item_code": "SKU2", "sale_date": "2026-10-01", "sales_qty": 50.0, "sales_amount": 125.0},
        # Day 2: 50 units on SKU1, 100 on SKU2 = 150 total
        {"store_code": "101", "item_code": "SKU1", "sale_date": "2026-10-02", "sales_qty": 50.0, "sales_amount": 125.0},
        {"store_code": "102", "item_code": "SKU2", "sale_date": "2026-10-02", "sales_qty": 100.0, "sales_amount": 250.0},
        # Unmatched store (should be excluded)
        {"store_code": "999", "item_code": "SKU1", "sale_date": "2026-10-01", "sales_qty": 500.0, "sales_amount": 1250.0},
    ])

def test_series_built_from_fixture_not_even(mock_fact_df, mock_db_sales):
    """Verifies that daily sales values reflect real uneven fixture sales, not an even split."""
    series = calculate_daily_sales_series(
        db_df=mock_db_sales,
        fact_df=mock_fact_df,
        beg_date="2026-10-01",
        end_date="2026-10-05",
        total_fc=2000.0,
        total_fc_azn=5000.0,
        as_of_date="2026-10-02"
    )
    assert series is not None
    assert len(series) == 5

    # Day 1: 350 units (17.5%), Day 2: 150 units (7.5%)
    assert series[0]["daily_sale"] == 350.0
    assert series[0]["daily_pct"] == 17.5
    assert series[1]["daily_sale"] == 150.0
    assert series[1]["daily_pct"] == 7.5

    # Distinct values, not an even split!
    assert series[0]["daily_sale"] != series[1]["daily_sale"]
    assert series[0]["daily_pct"] != series[1]["daily_pct"]

def test_days_after_last_date_are_null(mock_fact_df, mock_db_sales):
    """Verifies that days after the latest available sale_date have null values (no future lines)."""
    series = calculate_daily_sales_series(
        db_df=mock_db_sales,
        fact_df=mock_fact_df,
        beg_date="2026-10-01",
        end_date="2026-10-05",
        total_fc=2000.0,
        total_fc_azn=5000.0,
        as_of_date="2026-10-02"
    )
    assert series is not None
    # Days 3, 4, 5 are after Day 2 (2026-10-02)
    for s in series[2:]:
        assert s["daily_sale"] is None
        assert s["daily_pct"] is None
        assert s["cumulative_pct"] is None
        assert s["is_future"] is True
        assert s["partial"] is False

def test_partial_day_flag(mock_fact_df, mock_db_sales):
    """Verifies that if the latest available date is today (as_of_date), it is marked partial=True."""
    series = calculate_daily_sales_series(
        db_df=mock_db_sales,
        fact_df=mock_fact_df,
        beg_date="2026-10-01",
        end_date="2026-10-05",
        total_fc=2000.0,
        total_fc_azn=5000.0,
        as_of_date="2026-10-02"
    )
    assert series is not None
    # Day 1 (yesterday) is not partial
    assert series[0]["partial"] is False
    # Day 2 (today / latest available) is partial
    assert series[1]["partial"] is True

def test_ideal_line_values(mock_fact_df, mock_db_sales):
    """Verifies ideal pro-rata line values: 100 * i / N across the full campaign."""
    series = calculate_daily_sales_series(
        db_df=mock_db_sales,
        fact_df=mock_fact_df,
        beg_date="2026-10-01",
        end_date="2026-10-05",
        total_fc=2000.0,
        total_fc_azn=5000.0,
        as_of_date="2026-10-02"
    )
    assert series is not None
    assert len(series) == 5
    expected_ideals = [20.0, 40.0, 60.0, 80.0, 100.0]
    for s, exp in zip(series, expected_ideals):
        assert s["ideal_pct"] == exp

def test_reconciliation_last_cumulative_equals_dashboard_achievement(mock_fact_df, mock_db_sales):
    """Verifies that the last real cumulative point equals (total SALE / total FC) * 100."""
    total_fc = float(mock_fact_df["FC"].sum())   # 2000.0
    total_sale = float(mock_fact_df["SALE"].sum()) # 500.0
    expected_achievement = round((total_sale / total_fc) * 100.0, 2) # 25.0%

    series = calculate_daily_sales_series(
        db_df=mock_db_sales,
        fact_df=mock_fact_df,
        beg_date="2026-10-01",
        end_date="2026-10-05",
        total_fc=total_fc,
        total_fc_azn=5000.0,
        as_of_date="2026-10-02"
    )
    assert series is not None
    real_points = [s for s in series if s["cumulative_pct"] is not None]
    last_real_point = real_points[-1]

    # Reconciliation: last real cumulative point must equal dashboard achievement %
    assert last_real_point["cumulative_pct"] == expected_achievement
    assert last_real_point["cumulative_pct"] == 25.0

def test_old_archive_without_daily_sales_returns_null(mock_fact_df):
    """Verifies that older archives without daily sales return null, triggering empty state (never even split)."""
    # When db_df is None (older archive scenario)
    series = calculate_daily_sales_series(
        db_df=None,
        fact_df=mock_fact_df,
        beg_date="2026-10-01",
        end_date="2026-10-05",
        total_fc=2000.0
    )
    assert series is None

    # ensure_complete_analytics_payload also defaults daily_sales to None
    payload = ensure_complete_analytics_payload({})
    assert payload["daily_sales"] is None
