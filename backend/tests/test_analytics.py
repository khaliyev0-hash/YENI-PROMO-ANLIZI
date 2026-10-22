import pytest
import pandas as pd
import numpy as np
import io

from app.schemas import AppSettings, ColumnMapping
from app.parser import detect_columns, analyze_data_quality
from app.normalizer import normalize_excel_data
from app.analytics.kpi_calculator import calculate_kpis
from app.analytics.forecast_accuracy import calculate_forecast_accuracy
from app.analytics.stockout_analysis import analyze_stockouts_and_lost_sales
from app.analytics.health_scores import calculate_promo_health_score
from app.analytics.segmentation import perform_abc_analysis
from app.demo_data import generate_demo_excel

def test_detect_columns_format_a():
    df = pd.DataFrame({
        "Mehsul_kodu": ["101201"],
        "Magaza": ["101"],
        "Mehsul_adi": ["BANAN"],
        "PROGNOZ": [60]
    })
    mapping, confidence = detect_columns(df.columns.tolist())
    assert mapping.code_col == "Mehsul_kodu"
    assert mapping.store_col == "Magaza"
    assert mapping.fc_col == "PROGNOZ"
    assert confidence == 1.0

def test_detect_fc_mebleg_column():
    df = pd.DataFrame({
        "Mehsul_kodu": ["101201"],
        "Magaza": ["101"],
        "Mehsul_adi": ["BANAN"],
        "PROGNOZ": [60],
        "fc mebleg": [150.5]
    })
    mapping, confidence = detect_columns(df.columns.tolist())
    assert mapping.fc_mebleg_col == "fc mebleg"
    fact_df, _ = normalize_excel_data(df, mapping)
    assert "FC_MEBLEG" in fact_df.columns
    assert fact_df["FC_MEBLEG"].iloc[0] == 150.5
    settings = AppSettings()
    kpis = calculate_kpis(fact_df, pd.DataFrame(), settings)
    assert kpis["total_forecast_azn"] == 150.5

def test_detect_columns_format_b_dynamic_dates():
    cols = [
        "STORE", "CODE", "NAME", "FC", "SALE",
        "STOCK 01.09.2026", "STOCK 02.09.2026", "STOCK 03.09.2026"
    ]
    mapping, confidence = detect_columns(cols)
    assert mapping.store_col == "STORE"
    assert len(mapping.daily_stock_cols) == 3
    assert mapping.daily_stock_cols[0] == "STOCK 01.09.2026"
    assert mapping.daily_stock_cols[-1] == "STOCK 03.09.2026"
    assert confidence == 1.0

def test_normalization_and_kpi():
    df = pd.DataFrame({
        "STORE": ["101", "101", "102"],
        "CODE": ["P1", "P2", "P1"],
        "NAME": ["Item 1", "Item 2", "Item 1"],
        "FC": [100, 50, 200],
        "SALE": [80, 50, 220],
        "STOCK": [0, 10, 30]
    })
    mapping = ColumnMapping(
        store_col="STORE", code_col="CODE", name_col="NAME",
        fc_col="FC", sale_col="SALE", stock_col="STOCK"
    )
    fact_df, timeline_df = normalize_excel_data(df, mapping)
    settings = AppSettings()
    
    kpis = calculate_kpis(fact_df, timeline_df, settings)
    assert kpis["total_stores"] == 2
    assert kpis["total_products"] == 2
    assert kpis["total_forecast"] == 350.0
    assert kpis["total_sales"] == 350.0
    assert kpis["achievement_pct"] == 100.0
    assert kpis["stockout_stores_count"] == 1

def test_forecast_accuracy():
    fact_df = pd.DataFrame({
        "FC": [100, 100],
        "SALE": [80, 120]
    })
    accuracy = calculate_forecast_accuracy(fact_df)
    # Total FC = 200, Total SALE = 200, Abs error = |80-100| + |120-100| = 40
    # WAPE = 40 / 200 * 100 = 20.0%
    assert accuracy.wape == 20.0
    assert accuracy.mae == 20.0
    assert accuracy.bias == 0.0

def test_demo_data_generation():
    bytes_a = generate_demo_excel("A")
    df_a = pd.read_excel(io.BytesIO(bytes_a))
    assert not df_a.empty
    assert "PROGNOZ" in df_a.columns

    bytes_b = generate_demo_excel("B")
    df_b = pd.read_excel(io.BytesIO(bytes_b))
    assert not df_b.empty
    assert "STOCK 01.09.2026" in df_b.columns

def test_merge_excel_with_db_successful_match():
    from app.normalizer import merge_excel_with_db
    excel_df = pd.DataFrame({
        "STORE": ["101"],
        "CODE": ["P1"],
        "NAME": ["Banana"],
        "FC": [100.0]
    })
    db_df = pd.DataFrame({
        "store_code": ["101"],
        "item_code": ["P1"],
        "sales_qty": [85.0],
        "current_stock": [25.0]
    })
    mapping = ColumnMapping(store_col="STORE", code_col="CODE", fc_col="FC")
    merged = merge_excel_with_db(excel_df, mapping, db_df)
    
    assert len(merged) == 1
    assert merged.iloc[0]['STORE'] == "101"
    assert merged.iloc[0]['CODE'] == "P1"
    assert merged.iloc[0]['SALE'] == 85.0
    assert merged.iloc[0]['FINAL_STOCK'] == 25.0

def test_merge_excel_with_db_unmatched_default_zero():
    from app.normalizer import merge_excel_with_db
    excel_df = pd.DataFrame({
        "STORE": ["101"],
        "CODE": ["NEW_ITEM_99"],
        "NAME": ["New Item"],
        "FC": [50.0]
    })
    db_df = pd.DataFrame({
        "store_code": ["101"],
        "item_code": ["P1"],
        "sales_qty": [100.0],
        "current_stock": [30.0]
    })
    mapping = ColumnMapping(store_col="STORE", code_col="CODE", fc_col="FC")
    merged = merge_excel_with_db(excel_df, mapping, db_df)
    
    assert len(merged) == 1
    assert merged.iloc[0]['CODE'] == "NEW_ITEM_99"
    assert merged.iloc[0]['SALE'] == 0.0
    assert merged.iloc[0]['FINAL_STOCK'] == 0.0

def test_template_1_direct_store_code_merge():
    from app.normalizer import merge_excel_with_db
    excel_df = pd.DataFrame({
        "Mehsul_kodu": ["P100", "P100"],
        "Magaza": ["ST-1", "ST-2"],
        "Mehsul_adi": ["Banan Premium", "Banan Premium"],
        "FC": [60.0, 40.0],
        "Dagilim Miqdari": [120.0, 80.0]
    })
    mapping = ColumnMapping(code_col="Mehsul_kodu", store_col="Magaza", name_col="Mehsul_adi", fc_col="FC", distribution_col="Dagilim Miqdari")
    db_df = pd.DataFrame({
        "store_code": ["ST-1", "ST-2"],
        "item_code": ["P100", "P100"],
        "sales_qty": [50.0, 35.0],
        "current_stock": [10.0, 15.0]
    })

    merged_df = merge_excel_with_db(excel_df, mapping, db_df)
    assert len(merged_df) == 2
    assert set(merged_df['STORE']) == {"ST-1", "ST-2"}
    assert merged_df[merged_df['STORE'] == "ST-1"].iloc[0]['SALE'] == 50.0
    assert merged_df[merged_df['STORE'] == "ST-2"].iloc[0]['SALE'] == 35.0

def test_template_2_service_level_direct_parsing():
    from app.normalizer import parse_service_level_excel
    from app.schemas import ServiceLevelColumnMapping
    excel_df = pd.DataFrame({
        "Mehsul_kodu": ["P200"],
        "Mehsul_adi": ["Şəkər Tozu"],
        "Magaza": ["ST-101"],
        "Sifariş miqdarı": [200.0],
        "Qarşılanan miqdar": [180.0],
        "Təminat %": [90.0],
        "Firma": ["Milli Şəkər MMC"]
    })
    sl_mapping = ServiceLevelColumnMapping(
        code_col="Mehsul_kodu",
        name_col="Mehsul_adi",
        store_col="Magaza",
        order_qty_col="Sifariş miqdarı",
        fulfilled_qty_col="Qarşılanan miqdar",
        service_level_pct_col="Təminat %",
        supplier_col="Firma"
    )
    records = parse_service_level_excel(excel_df, sl_mapping)
    assert len(records) == 1
    assert records[0]["store"] == "ST-101"
    assert records[0]["code"] == "P200"
    assert records[0]["ordered_qty"] == 200.0
    assert records[0]["accepted_qty"] == 180.0
    assert records[0]["service_level_pct"] == 90.0
    assert records[0]["supplier"] == "Milli Şəkər MMC"
    assert records[0]["status"] == "GOOD"

def test_merge_excel_with_db_strictly_excel_driven():
    from app.normalizer import merge_excel_with_db
    # Excel has exactly 3 (store, code) rows
    excel_df = pd.DataFrame({
        "Mehsul_kodu": ["P100", "P101", "P102"],
        "Magaza": ["ST-1", "ST-1", "ST-2"],
        "Mehsul_adi": ["Banan", "Alma", "Armud"],
        "FC": [100.0, 50.0, 75.0]
    })
    mapping = ColumnMapping(code_col="Mehsul_kodu", store_col="Magaza", name_col="Mehsul_adi", fc_col="FC")
    
    # DB has 8 total (store, code) rows (3 matching Excel + 5 extra DB-only items)
    db_df = pd.DataFrame({
        "store_code": ["ST-1", "ST-1", "ST-2", "ST-3", "ST-3", "ST-4", "ST-4", "ST-5"],
        "item_code": ["P100", "P101", "P102", "EXTRA-1", "EXTRA-2", "EXTRA-3", "EXTRA-4", "EXTRA-5"],
        "sales_qty": [90.0, 45.0, 70.0, 500.0, 300.0, 150.0, 200.0, 100.0],
        "current_stock": [10.0, 5.0, 5.0, 50.0, 30.0, 15.0, 20.0, 10.0]
    })

    merged = merge_excel_with_db(excel_df, mapping, db_df)

    # Must contain EXACTLY 3 rows matching Excel keys, NOT 8!
    assert len(merged) == 3
    assert set(merged['CODE']) == {"P100", "P101", "P102"}
    assert set(merged['STORE']) == {"ST-1", "ST-2"}
    assert "EXTRA-1" not in merged['CODE'].values
    assert "EXTRA-5" not in merged['CODE'].values

def test_normalize_store_code():
    from app.db import normalize_store_code
    assert normalize_store_code("ST-101") == "101"
    assert normalize_store_code("ST101") == "101"
    assert normalize_store_code("101") == "101"
    assert normalize_store_code("ST-005") == "5"
    assert normalize_store_code("000101") == "101"
    assert normalize_store_code(None) is None
    assert normalize_store_code("") is None

def test_normalize_item_code():
    from app.db import normalize_item_code
    assert normalize_item_code(" 101201 ") == "101201"
    assert normalize_item_code("P-100") == "P-100"
    assert normalize_item_code(None) is None
    assert normalize_item_code("") is None



