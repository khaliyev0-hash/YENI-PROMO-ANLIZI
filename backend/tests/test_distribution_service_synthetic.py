import pytest
from unittest.mock import patch
from app.distribution.excel_processor import ImportedRow
from app.distribution.service import run_distribution_planning

def test_full_synthetic_distribution_workflow():
    valid_rows = [
        # Store 101, Product 100003: High demand, needs 2 cases
        ImportedRow(row_number=2, store_code="101", product_code="100003", product_name="AHMAD TEA", shelf_capacity=30.0),
        # Store 102, Product 100003: Overstocked, 0 order
        ImportedRow(row_number=3, store_code="102", product_code="100003", product_name="AHMAD TEA", shelf_capacity=30.0),
        # Store 103, Product 105557: Blocked supplier (Tip 41 + BELI), 0 order
        ImportedRow(row_number=4, store_code="103", product_code="105557", product_name="DR SANTE", shelf_capacity=20.0),
        # Store 104, Product 102414: Exceeds shelf capacity warning
        ImportedRow(row_number=5, store_code="104", product_code="102414", product_name="WINE 750ML", shelf_capacity=10.0),
    ]

    mock_raw_stocks = [
        # Store 101, 100003: stock 5.0, case 12.0, unblocked
        {
            "IS YERI NO": "101", "URUN KODU": "100003", "URUN AD": "AHMAD TEA",
            "IS YERI TEDARUK TIPI": 41, "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 5.0, "QUTU ICI": 12.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        },
        # Store 102, 100003: stock 40.0, case 12.0, unblocked
        {
            "IS YERI NO": "102", "URUN KODU": "100003", "URUN AD": "AHMAD TEA",
            "IS YERI TEDARUK TIPI": 41, "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 40.0, "QUTU ICI": 12.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        },
        # Store 103, 105557: stock 2.0, BLOCKED by supplier (Tip 41 + BELI)
        {
            "IS YERI NO": "103", "URUN KODU": "105557", "URUN AD": "DR SANTE",
            "IS YERI TEDARUK TIPI": 41, "TEDARİKCİ BLOKAJİ": "BELI",
            "Stok miqdari": 2.0, "QUTU ICI": 6.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        },
        # Store 104, 102414: stock 0.0, case 12.0, unblocked
        {
            "IS YERI NO": "104", "URUN KODU": "102414", "URUN AD": "WINE 750ML",
            "IS YERI TEDARUK TIPI": 40, "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 0.0, "QUTU ICI": 12.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        }
    ]

    mock_forecast = {
        ("101", "100003"): 20.0, # Net req = 20 - 5 = 15 -> 2 cases (24 units)
        ("102", "100003"): 10.0, # Net req = 0 (Stock 40 >= 10) -> 0 cases
        ("103", "105557"): 15.0, # Blocked -> 0 cases, Warning SUPPLIER_BLOCKED
        ("104", "102414"): 18.0  # Net req = 18 -> 2 cases (24 units), ShelfCap = 10 -> Warning EXCEEDS_SHELF_CAPACITY
    }

    with patch("app.distribution.service.query_stock_details_for_skus", return_value=mock_raw_stocks), \
         patch("app.distribution.service.query_sales_history_and_forecast", return_value=(mock_forecast, {"100003": 15.0, "105557": 15.0, "102414": 18.0})):

        res = run_distribution_planning(
            title="Synthetic Test Run",
            valid_excel_rows=valid_rows,
            start_date_str="2026-11-01",
            duration_days=7,
            target_ending_stock=0.0
        )

        assert res["run_id"] is not None
        summary = res["summary"]
        assert summary["store_count"] == 4
        assert summary["product_count"] == 3

        orders = { (o["store_code"], o["product_code"]): o for o in res["orders"] }

        # Store 101, 100003
        o101 = orders[("101", "100003")]
        assert o101["net_requirement"] == 15.0
        assert o101["recommended_cases"] == 2
        assert o101["recommended_order_units"] == 24.0
        assert o101["warning_status"] == "OK"

        # Store 102, 100003
        o102 = orders[("102", "100003")]
        assert o102["net_requirement"] == 0.0
        assert o102["recommended_order_units"] == 0.0

        # Store 103, 105557 (Blocked)
        o103 = orders[("103", "105557")]
        assert o103["is_blocked"] is True
        assert o103["recommended_order_units"] == 0.0
        assert o103["warning_status"] == "SUPPLIER_BLOCKED"

        # Store 104, 102414 (Exceeds shelf capacity)
        o104 = orders[("104", "102414")]
        assert o104["recommended_order_units"] == 24.0
        assert o104["warning_status"] == "EXCEEDS_SHELF_CAPACITY"

        # Check Exceptions
        exc_types = [e["exception_type"] for e in res["exceptions"]]
        assert "SUPPLIER_BLOCKED" in exc_types

def test_zero_stock_and_zero_sales_fallback_to_network_average():
    # Store 133: Stock = 0, 0 historical sales, ShelfCapacity = 32, CasePack = 64
    valid_rows = [
        ImportedRow(row_number=2, store_code="133", product_code="192211", product_name="SOLEN NUTYMAX", shelf_capacity=32.0),
        ImportedRow(row_number=3, store_code="126", product_code="192211", product_name="SOLEN NUTYMAX", shelf_capacity=32.0),
    ]

    mock_raw_stocks = [
        {
            "IS YERI NO": "133", "URUN KODU": "192211", "URUN AD": "SOLEN NUTYMAX",
            "IS YERI TEDARUK TIPI": 41, "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 0.0, "QUTU ICI": 64.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        },
        {
            "IS YERI NO": "126", "URUN KODU": "192211", "URUN AD": "SOLEN NUTYMAX",
            "IS YERI TEDARUK TIPI": 41, "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 100.0, "QUTU ICI": 64.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        }
    ]

    # Store 133 had 0 sales (missing in map), Store 126 had sales
    mock_forecast = {
        ("126", "192211"): 7.0
    }
    network_averages = {
        "192211": 5.6
    }

    with patch("app.distribution.service.query_stock_details_for_skus", return_value=mock_raw_stocks), \
         patch("app.distribution.service.query_sales_history_and_forecast", return_value=(mock_forecast, network_averages)):

        res = run_distribution_planning(
            title="Zero Stock Fallback Test",
            valid_excel_rows=valid_rows,
            start_date_str="2026-11-01",
            duration_days=7
        )

        orders = { o["store_code"]: o for o in res["orders"] }
        o133 = orders["133"]

        # Store 133 MUST receive network average forecast (5.6), NOT 0.0!
        assert o133["forecast_demand"] == 5.6
        assert o133["current_stock"] == 0.0
        # Net requirement must be positive
        assert o133["net_requirement"] == 5.6
        # Recommended order must be 1 box (64 units), NOT 0!
        assert o133["recommended_cases"] == 1
        assert o133["recommended_order_units"] == 64.0
        assert "FALLBACK_NETWORK_AVG" in o133["warning_status"] or "EXCEEDS_SHELF_CAPACITY" in o133["warning_status"]

        # Store 126 already had 100 units in stock, so it gets 0 order
        o126 = orders["126"]
        assert o126["recommended_order_units"] == 0.0

def test_stockout_correction_and_uplift_workflow():
    valid_rows = [
        ImportedRow(row_number=2, store_code="101", product_code="100003", product_name="AHMAD TEA", shelf_capacity=30.0),
    ]
    mock_raw_stocks = [
        {
            "IS YERI NO": "101", "URUN KODU": "100003", "URUN AD": "AHMAD TEA",
            "IS YERI TEDARUK TIPI": 41, "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 0.0, "QUTU ICI": 10.0, "BLOK ICI": 1.0, "VAHIDI": "ADET"
        }
    ]

    # When query_sales_history_and_forecast is called, verify that stockout_correction and promo_uplift_pct are passed
    called_kwargs = {}
    def mock_query(*args, **kwargs):
        called_kwargs.update(kwargs)
        return ({("101", "100003"): 26.0}, {"100003": 26.0})

    with patch("app.distribution.service.query_stock_details_for_skus", return_value=mock_raw_stocks), \
         patch("app.distribution.service.query_sales_history_and_forecast", side_effect=mock_query):

        res = run_distribution_planning(
            title="Uplift & Stockout Test",
            valid_excel_rows=valid_rows,
            start_date_str="2026-11-01",
            duration_days=7,
            stockout_correction=True,
            promo_uplift_pct=30.0
        )

        assert called_kwargs.get("stockout_correction") is False
        assert res["orders"][0]["forecast_demand"] == 33.8  # 26.0 * 1.30 uplift
        assert res["summary"]["promo_uplift_pct"] == 30.0
        assert res["summary"]["stockout_correction"] is False
        assert res["summary"]["stockout_correction_applied"] is False
        assert "+30%" in res["parameters"]["Promo Uplift Artım Faizi"]
        assert "Deaktiv" in res["parameters"]["Stok-out Düzəlişi"]

