import os
import shutil
import tempfile
import pytest
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from app.db import normalize_store_code, normalize_item_code
from app.parquet_store import read_sales, coverage, read_items
from scripts.export_sales_to_parquet import save_single_sales_parquet

def test_store_item_normalization():
    assert normalize_store_code("ST-101") == "101"
    assert normalize_store_code("ST-005") == "5"
    assert normalize_store_code("101") == "101"
    assert normalize_store_code("000101") == "101"
    assert normalize_store_code(None) is None

    assert normalize_item_code("  100003  ") == "100003"
    assert normalize_item_code(None) is None

def test_single_parquet_atomic_write(tmp_path, monkeypatch):
    single_file = tmp_path / "sales.parquet"
    monkeypatch.setattr("scripts.export_sales_to_parquet.SINGLE_SALES_FILE", str(single_file))
    monkeypatch.setattr("scripts.export_sales_to_parquet.PARQUET_BASE", str(tmp_path))

    df_sample = pd.DataFrame({
        "sale_date": ["2026-09-01", "2026-09-01"],
        "store_code": ["ST-101", "102"],
        "item_code": [" 2001 ", "2002"],
        "sales_qty": [10.5, 5.0],
        "sales_amount": [100.0, 50.0]
    })

    save_single_sales_parquet(df_sample)

    tmp_file = tmp_path / "sales.parquet.tmp"

    assert single_file.exists()
    assert not tmp_file.exists()

    table = pq.read_table(str(single_file))
    res_df = table.to_pandas()
    assert len(res_df) == 2
    assert {"sale_date", "store_code", "item_code", "sales_qty", "sales_amount"}.issubset(set(res_df.columns))

def test_reader_filters_and_coverage(tmp_path, monkeypatch):
    single_sales = tmp_path / "sales.parquet"
    items_file = tmp_path / "items.parquet"

    monkeypatch.setattr("app.parquet_store.SINGLE_SALES_FILE", str(single_sales))
    monkeypatch.setattr("app.parquet_store.ITEMS_FILE", str(items_file))

    df_sample = pd.DataFrame({
        "sale_date": ["2026-09-01", "2026-09-01", "2026-09-03", "2026-09-03"],
        "store_code": ["101", "104", "101", "105"],
        "item_code": ["2001", "2002", "2001", "2003"],
        "sales_qty": [10.0, 20.0, 15.0, 25.0],
        "sales_amount": [100.0, 200.0, 150.0, 250.0]
    })

    table = pa.Table.from_pandas(df_sample)
    pq.write_table(table, str(single_sales))

    cov_info = coverage()
    assert cov_info["min_date"] == "2026-09-01"
    assert cov_info["max_date"] == "2026-09-03"
    assert cov_info["missing_days"] == ["2026-09-02"]
    assert cov_info["total_rows"] == 4

    df_read = read_sales("2026-09-01", "2026-09-01")
    assert len(df_read) == 2
    assert (df_read["sale_date"] == "2026-09-01").all()

    df_store = read_sales("2026-09-01", "2026-09-03", store_codes=["ST-101"])
    assert len(df_store) == 2
    assert (df_store["store_code"] == "101").all()

    df_item = read_sales("2026-09-01", "2026-09-03", item_codes=["2003"])
    assert len(df_item) == 1
    assert df_item.iloc[0]["item_code"] == "2003"
