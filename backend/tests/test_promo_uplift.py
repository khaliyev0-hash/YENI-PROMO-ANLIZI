import pytest
import pandas as pd
from app.analytics.promo_uplift import compute_promo_uplift

def test_compute_promo_uplift_basic():
    # 5-day campaign: 2026-10-01 to 2026-10-05
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "PROMO_TYPE": "tesir", "FC": 100, "SALE": 80, "FINAL_STOCK": 20},
        {"STORE": "102", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "PROMO_TYPE": "tesir", "FC": 100, "SALE": 70, "FINAL_STOCK": 10},
        {"STORE": "101", "CODE": "SKU2", "NAME": "Çörək", "CATEGORY": "Un", "PROMO_TYPE": "adi", "FC": 50, "SALE": 60, "FINAL_STOCK": 5},
        {"STORE": "101", "CODE": "SKU3", "NAME": "Yeni Şirniyyat", "CATEGORY": "Şirniyyat", "PROMO_TYPE": "adi", "FC": 40, "SALE": 30, "FINAL_STOCK": 10},
    ]
    df = pd.DataFrame(data)

    # Mock 14-day regular normal sales
    # SKU1: 140 units in 14 days -> 10 units/day -> for 5 promo days baseline is 50 units
    # SKU1 promo sale: 80 + 70 = 150 units. Uplift: +100 units (+200% uplift) -> HIGH
    # SKU2: 140 units in 14 days -> 10 units/day -> for 5 promo days baseline is 50 units
    # SKU2 promo sale: 60 units. Uplift: +10 units (+20% uplift) -> MODERATE
    # SKU3: 0 baseline (new product) -> 30 promo sale -> NEW
    custom_baseline = {
        "SKU1": 140.0,
        "SKU2": 140.0,
        "SKU3": 0.0
    }
    custom_last_day = {
        "SKU1": 25.0,
        "SKU2": 12.0,
        "SKU3": 5.0
    }

    res = compute_promo_uplift(
        fact_df=df,
        beg_date="2026-10-01",
        end_date="2026-10-05",
        custom_baseline_map=custom_baseline,
        custom_last_day_map=custom_last_day
    )

    assert res["promo_days"] == 5
    summary = res["summary"]
    assert summary["total_skus"] == 3
    assert summary["total_promo_sale"] == 240.0 # 150 + 60 + 30
    assert summary["total_normal_14d"] == 280.0
    assert summary["total_baseline"] == 100.0   # 50 + 50 + 0
    assert summary["total_uplift_qty"] == 140.0 # 240 - 100
    assert summary["total_last_day_sale"] == 42.0 # 25 + 12 + 5

    items = res["items"]
    assert len(items) == 3

    # Check SKU1
    sku1 = next(it for it in items if it["code"] == "SKU1")
    assert sku1["promo_sale"] == 150.0
    assert sku1["normal_14d_sale"] == 140.0
    assert sku1["daily_baseline"] == 10.0
    assert sku1["baseline_sale"] == 50.0
    assert sku1["uplift_qty"] == 100.0
    assert sku1["uplift_pct"] == 200.0
    assert sku1["uplift_ratio"] == 3.0
    assert sku1["status"] == "HIGH"
    assert sku1["last_day_sale"] == 25.0
    assert sku1["store_count"] == 2

    # Check SKU2
    sku2 = next(it for it in items if it["code"] == "SKU2")
    assert sku2["promo_sale"] == 60.0
    assert sku2["baseline_sale"] == 50.0
    assert sku2["uplift_qty"] == 10.0
    assert sku2["uplift_pct"] == 20.0
    assert sku2["status"] == "MODERATE"
    assert sku2["last_day_sale"] == 12.0

    # Check SKU3
    sku3 = next(it for it in items if it["code"] == "SKU3")
    assert sku3["baseline_sale"] == 0.0
    assert sku3["uplift_qty"] == 30.0
    assert sku3["status"] == "NEW"

def test_compute_promo_uplift_negative():
    # Promo sale lower than baseline
    df = pd.DataFrame([
        {"STORE": "101", "CODE": "SKU_SLOW", "NAME": "Zəif Məhsul", "CATEGORY": "Baqaliyya", "PROMO_TYPE": "adi", "FC": 50, "SALE": 20, "FINAL_STOCK": 30}
    ])
    # 14 days normal: 70 units -> 5 units/day -> 6 days baseline is 30 units
    # Promo sale: 20 units -> Uplift: -10 units (-33.3%) -> NEGATIVE
    res = compute_promo_uplift(
        fact_df=df,
        beg_date="2026-10-01",
        end_date="2026-10-06", # 6 days
        custom_baseline_map={"SKU_SLOW": 70.0},
        custom_last_day_map={"SKU_SLOW": 2.0}
    )
    item = res["items"][0]
    assert item["baseline_sale"] == 30.0
    assert item["promo_sale"] == 20.0
    assert item["uplift_qty"] == -10.0
    assert item["uplift_pct"] == -33.3
    assert item["status"] == "NEGATIVE"

def test_compute_promo_uplift_filters():
    data = [
        {"STORE": "101", "CODE": "S1", "NAME": "Cola", "CATEGORY": "İçki", "PROMO_TYPE": "tesir", "FC": 100, "SALE": 80, "FINAL_STOCK": 10},
        {"STORE": "101", "CODE": "S2", "NAME": "Fanta", "CATEGORY": "İçki", "PROMO_TYPE": "adi", "FC": 100, "SALE": 50, "FINAL_STOCK": 10},
        {"STORE": "101", "CODE": "S3", "NAME": "Yağ", "CATEGORY": "Ərzaq", "PROMO_TYPE": "tesir", "FC": 100, "SALE": 70, "FINAL_STOCK": 10},
    ]
    df = pd.DataFrame(data)
    baseline = {"S1": 70.0, "S2": 70.0, "S3": 70.0}

    # Filter by category = "İçki"
    res_cat = compute_promo_uplift(df, category_filter="İçki", custom_baseline_map=baseline)
    assert len(res_cat["items"]) == 2
    assert all(it["category"] == "İçki" for it in res_cat["items"])

    # Filter by promo_type = "tesir"
    res_pt = compute_promo_uplift(df, promo_type_filter="tesir", custom_baseline_map=baseline)
    assert len(res_pt["items"]) == 2
    assert all("tesir" in it["promo_type"] for it in res_pt["items"])

    # Search query
    res_search = compute_promo_uplift(df, search_query="fanta", custom_baseline_map=baseline)
    assert len(res_search["items"]) == 1
    assert res_search["items"][0]["name"] == "Fanta"

def test_compute_promo_uplift_empty():
    res = compute_promo_uplift(pd.DataFrame())
    assert res["summary"]["total_skus"] == 0
    assert res["items"] == []

def test_compute_promo_uplift_ongoing_campaign():
    # 14-day promo from 2026-10-15 to 2026-10-28, but only 3 days recorded
    df = pd.DataFrame([
        {"STORE": "101", "CODE": "SKU_ONGOING", "NAME": "Süd", "CATEGORY": "Süd", "PROMO_TYPE": "adi", "FC": 70, "SALE": 45, "FINAL_STOCK": 20}
    ])
    # 14 days normal: 140 -> 10 units/day.
    # In 3 elapsed days: baseline should be 10 * 3 = 30 units (NOT 10 * 14 = 140 units!)
    # Promo sale: 45 units in 3 days -> Uplift: +15 units (+50% uplift) -> MODERATE
    mock_daily_sales = [
        {"date": "2026-10-15", "daily_sale": 15.0, "is_future": False},
        {"date": "2026-10-16", "daily_sale": 15.0, "is_future": False},
        {"date": "2026-10-17", "daily_sale": 15.0, "is_future": False},
        {"date": "2026-10-18", "daily_sale": None, "is_future": True},
    ]
    res = compute_promo_uplift(
        fact_df=df,
        beg_date="2026-10-15",
        end_date="2026-10-28",
        daily_sales_records=mock_daily_sales,
        custom_baseline_map={"SKU_ONGOING": 140.0},
        custom_last_day_map={"SKU_ONGOING": 15.0}
    )
    assert res["promo_days"] == 14
    assert res["elapsed_days"] == 3
    assert res["is_ongoing"] is True
    assert res["latest_sales_date"] == "2026-10-17"

    item = res["items"][0]
    assert item["baseline_sale"] == 30.0
    assert item["promo_sale"] == 45.0
    assert item["uplift_qty"] == 15.0
    assert item["uplift_pct"] == 50.0
    assert item["status"] == "MODERATE"
    assert item["last_day_sale"] == 15.0

def test_compute_promo_uplift_store_filter():
    df = pd.DataFrame([
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola", "CATEGORY": "İçki", "PROMO_TYPE": "adi", "FC": 50, "SALE": 40, "FINAL_STOCK": 10},
        {"STORE": "102", "CODE": "SKU1", "NAME": "Cola", "CATEGORY": "İçki", "PROMO_TYPE": "adi", "FC": 50, "SALE": 35, "FINAL_STOCK": 15},
    ])
    res = compute_promo_uplift(
        fact_df=df,
        beg_date="2026-10-01",
        end_date="2026-10-05", # 5 days (completed)
        store_filter="101",
        custom_baseline_map={"SKU1": 70.0}, # 5 units/day -> 25 units for 5 days
        custom_last_day_map={"SKU1": 8.0}
    )
    assert len(res["items"]) == 1
    item = res["items"][0]
    # For store 101 only, promo_sale should be 40 (not 75)
    assert item["promo_sale"] == 40.0
    assert item["store_count"] == 1
