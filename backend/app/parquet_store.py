import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union

import pandas as pd
import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.parquet as pq

from app.db import normalize_store_code, normalize_item_code

PARQUET_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "parquet_cache"))
SINGLE_SALES_FILE = os.path.join(PARQUET_BASE, "sales.parquet")
OLD_SALES_DIR = os.path.join(PARQUET_BASE, "sales")
ITEMS_FILE = os.path.join(PARQUET_BASE, "items.parquet")

def get_sales_dataset_source():
    if os.path.exists(SINGLE_SALES_FILE):
        return SINGLE_SALES_FILE, "single"
    elif os.path.exists(OLD_SALES_DIR):
        return OLD_SALES_DIR, "hive"
    return None, None

def read_sales(
    beg_date: str,
    end_date: str,
    store_codes: Optional[List[str]] = None,
    item_codes: Optional[List[str]] = None
) -> pd.DataFrame:
    """
    High-Performance Sales History Reader:
    Reads from single sales.parquet file (or Hive sales folder fallback)
    using PyArrow dataset filtering.
    """
    source_path, mode = get_sales_dataset_source()
    if not source_path:
        return pd.DataFrame(columns=['sale_date', 'store_code', 'item_code', 'sales_qty', 'sales_amount'])

    dataset_kwargs = {"format": "parquet"}
    if mode == "hive":
        dataset_kwargs["partitioning"] = "hive"

    dataset = ds.dataset(source_path, **dataset_kwargs)

    filters = []
    if beg_date:
        filters.append(ds.field("sale_date") >= beg_date)
    if end_date:
        filters.append(ds.field("sale_date") <= end_date)

    columns = ['sale_date', 'store_code', 'item_code', 'sales_qty', 'sales_amount']

    try:
        from app.db import get_active_store_codes
        active_stores, _ = get_active_store_codes()
    except Exception:
        active_stores = None

    if store_codes:
        norm_stores = list(set(normalize_store_code(s) for s in store_codes if normalize_store_code(s)))
        if active_stores is not None:
            norm_stores = [s for s in norm_stores if s in active_stores]
        if norm_stores:
            filters.append(ds.field("store_code").isin(norm_stores))
        else:
            return pd.DataFrame(columns=columns)
    elif active_stores is not None:
        filters.append(ds.field("store_code").isin(list(active_stores)))

    if item_codes:
        norm_items = list(set(normalize_item_code(c) for c in item_codes if normalize_item_code(c)))
        if norm_items:
            filters.append(ds.field("item_code").isin(norm_items))

    combined_filter = None
    for f in filters:
        combined_filter = f if combined_filter is None else (combined_filter & f)

    try:
        table = dataset.to_table(filter=combined_filter, columns=columns)
        df = table.to_pandas()
    except Exception as e:
        print(f"Error reading parquet dataset: {e}")
        return pd.DataFrame(columns=columns)

    if df.empty:
        return pd.DataFrame(columns=columns)

    df['sale_date'] = df['sale_date'].astype(str)
    df['store_code'] = df['store_code'].astype(str)
    df['item_code'] = df['item_code'].astype(str)
    df['sales_qty'] = df['sales_qty'].astype('float64')
    df['sales_amount'] = df['sales_amount'].astype('float64')

    return df[columns]

def coverage() -> Dict[str, Any]:
    """
    Reports metadata coverage of the local Parquet sales dataset:
    min_date, max_date, missing_days, total_rows.
    """
    source_path, mode = get_sales_dataset_source()
    if not source_path:
        return {
            "min_date": None,
            "max_date": None,
            "missing_days": [],
            "total_rows": 0
        }

    dataset_kwargs = {"format": "parquet"}
    if mode == "hive":
        dataset_kwargs["partitioning"] = "hive"

    dataset = ds.dataset(source_path, **dataset_kwargs)
    total_rows = dataset.count_rows()

    # Read unique dates
    table_dates = dataset.to_table(columns=['sale_date'])
    partition_dates = sorted(table_dates.to_pandas()['sale_date'].astype(str).unique().tolist())

    if not partition_dates:
        return {
            "min_date": None,
            "max_date": None,
            "missing_days": [],
            "total_rows": 0
        }

    min_d = partition_dates[0]
    max_d = partition_dates[-1]

    d_start = datetime.strptime(min_d, "%Y-%m-%d").date()
    d_end = datetime.strptime(max_d, "%Y-%m-%d").date()

    all_expected_days = set()
    curr = d_start
    while curr <= d_end:
        all_expected_days.add(curr.strftime("%Y-%m-%d"))
        curr += timedelta(days=1)

    existing_set = set(partition_dates)
    missing_days = sorted(list(all_expected_days - existing_set))

    return {
        "min_date": min_d,
        "max_date": max_d,
        "missing_days": missing_days,
        "total_rows": total_rows
    }

def read_items() -> pd.DataFrame:
    """
    Reads the item master metadata dimension dataframe.
    """
    if not os.path.exists(ITEMS_FILE):
        return pd.DataFrame(columns=[
            'item_code', 'item_name', 'family_name', 'category_name',
            'sub_category_name', 'supplier_name', 'barcode'
        ])

    table = pq.read_table(ITEMS_FILE)
    df = table.to_pandas()
    return df
