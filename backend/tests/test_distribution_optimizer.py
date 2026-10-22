import pytest
from datetime import date
from app.distribution.optimizer import (
    calculate_campaign_end_date,
    calculate_net_order
)

def test_campaign_end_date_calculation():
    # 7-day campaign starting Nov 1 -> ends Nov 7 (inclusive 7 days)
    d1 = calculate_campaign_end_date(date(2026, 11, 1), 7)
    assert d1 == date(2026, 11, 7)

    # 14-day campaign starting Nov 1 -> ends Nov 14
    d2 = calculate_campaign_end_date(date(2026, 11, 1), 14)
    assert d2 == date(2026, 11, 14)

    # 1-day campaign
    d3 = calculate_campaign_end_date(date(2026, 11, 1), 1)
    assert d3 == date(2026, 11, 1)

    # Invalid days
    with pytest.raises(ValueError):
        calculate_campaign_end_date(date(2026, 11, 1), 0)

def test_net_requirement_and_case_rounding():
    # Forecast = 25, Stock = 10, TargetEnding = 5 -> NetReq = 20
    # CaseQuantity = 12 -> 2 cases = 24 units, Excess = 4
    item = calculate_net_order(
        store_code="101",
        product_code="100003",
        product_name="AHMAD TEA",
        start_date="2026-11-01",
        end_date="2026-11-07",
        duration_days=7,
        forecast_demand=25.0,
        current_stock=10.0,
        usable_current_stock=10.0,
        shelf_capacity=50.0,
        case_quantity=12.0,
        target_ending_stock=5.0
    )

    assert item.net_requirement == 20.0
    assert item.recommended_cases == 2
    assert item.recommended_order_units == 24.0
    assert item.excess_units_from_rounding == 4.0
    # Expected ending stock = Usable (10) + Order (24) - Forecast (25) = 9
    assert item.expected_ending_stock == 9.0
    assert item.warning_status == "OK"

def test_stock_exceeds_demand_zero_order():
    # Forecast = 10, Stock = 50 -> NetReq = 0, Order = 0
    item = calculate_net_order(
        store_code="101",
        product_code="100003",
        product_name="AHMAD TEA",
        start_date="2026-11-01",
        end_date="2026-11-07",
        duration_days=7,
        forecast_demand=10.0,
        current_stock=50.0,
        usable_current_stock=50.0,
        shelf_capacity=20.0,
        case_quantity=12.0
    )

    assert item.net_requirement == 0.0
    assert item.recommended_order_units == 0.0
    assert item.recommended_cases == 0
    assert item.expected_ending_stock == 40.0
    assert item.warning_status == "OK"

def test_exceeds_shelf_capacity_warning():
    # Recommended order = 24, but shelf capacity is only 15
    item = calculate_net_order(
        store_code="101",
        product_code="100003",
        product_name="AHMAD TEA",
        start_date="2026-11-01",
        end_date="2026-11-07",
        duration_days=7,
        forecast_demand=20.0,
        current_stock=0.0,
        usable_current_stock=0.0,
        shelf_capacity=15.0,
        case_quantity=12.0
    )

    assert item.recommended_order_units == 24.0
    assert item.warning_status == "EXCEEDS_SHELF_CAPACITY"
    assert "rəf tutumunu" in item.warning_message.lower()

def test_blocked_supplier_produces_zero_order():
    item = calculate_net_order(
        store_code="101",
        product_code="100003",
        product_name="AHMAD TEA",
        start_date="2026-11-01",
        end_date="2026-11-07",
        duration_days=7,
        forecast_demand=50.0,
        current_stock=5.0,
        usable_current_stock=0.0,
        shelf_capacity=30.0,
        case_quantity=12.0,
        is_blocked=True
    )

    assert item.net_requirement == 0.0
    assert item.recommended_order_units == 0.0
    assert item.warning_status == "SUPPLIER_BLOCKED"

def test_incoming_stock_is_not_deducted():
    # User requirement: incoming orders are removed and not deducted
    item = calculate_net_order(
        store_code="133",
        product_code="192211",
        product_name="SOLEN NUTYMAX",
        start_date="2026-11-01",
        end_date="2026-11-07",
        duration_days=7,
        forecast_demand=5.57,
        current_stock=0.0,
        usable_current_stock=0.0,
        eligible_incoming_stock=16.0,
        shelf_capacity=20.0,
        case_quantity=64.0,
        existing_warning="FALLBACK_NETWORK_AVG"
    )

    assert item.net_requirement == 5.57
    assert item.recommended_cases == 1
    assert item.recommended_order_units == 64.0


