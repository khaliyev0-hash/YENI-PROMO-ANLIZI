import pytest
from app.analytics.inflows import compute_inflows, compute_sales_adjusted_inflows, compute_over_stock, compute_over_stock_base

def test_spec_example():
    stocks = [10.0, 9.0, 12.0, 5.0, 15.0]
    inflows, total = compute_inflows(stocks)
    assert inflows == [None, 0.0, 3.0, 0.0, 10.0]
    assert total == 13.0

def test_strictly_decreasing():
    stocks = [10.0, 9.0, 8.0, 7.0]
    inflows, total = compute_inflows(stocks)
    assert inflows == [None, 0.0, 0.0, 0.0]
    assert total == 0.0

def test_flat_series():
    stocks = [5.0, 5.0, 5.0]
    inflows, total = compute_inflows(stocks)
    assert inflows == [None, 0.0, 0.0]
    assert total == 0.0

def test_multiple_inflows():
    stocks = [10.0, 15.0, 12.0, 20.0]
    inflows, total = compute_inflows(stocks)
    assert inflows == [None, 5.0, 0.0, 8.0]
    assert total == 13.0

def test_null_gap_in_middle():
    stocks = [10.0, None, 15.0]
    inflows, total = compute_inflows(stocks)
    assert inflows == [None, None, 5.0]
    assert total == 5.0

def test_first_day_only():
    stocks = [10.0]
    inflows, total = compute_inflows(stocks)
    assert inflows == [None]
    assert total == 0.0

def test_null_future_tail():
    stocks = [10.0, 12.0, None, None]
    inflows, total = compute_inflows(stocks)
    assert inflows == [None, 2.0, None, None]
    assert total == 2.0

def test_sales_adjusted_inflows():
    stocks = [10.0, 9.0, 12.0, 5.0, 15.0]
    sales = [0.0, 2.0, 0.0, 3.0, 1.0]
    inflows, total = compute_sales_adjusted_inflows(stocks, sales)
    # Day 0: None
    # Day 1: 9 - 10 + 2 = 1 -> 1.0
    # Day 2: 12 - 9 + 0 = 3 -> 3.0
    # Day 3: 5 - 12 + 3 = -4 -> 0.0
    # Day 4: 15 - 5 + 1 = 11 -> 11.0
    assert inflows == [None, 1.0, 3.0, 0.0, 11.0]
    assert total == 15.0

def test_over_stock_worked_example():
    # inflow 57, sale 7, ref 24, reg_30d 5 -> 57 - 7 - 24 - 5 = 21.0
    assert compute_over_stock(57, 7, 39, 24, 5) == 21.0
    # inflow 57, sale 7, ref 24, reg_30d 0 -> 57 - 7 - 24 - 0 = 26.0
    assert compute_over_stock(57, 7, 39, 24, 0) == 26.0
    assert compute_over_stock_base(57, 7) == 50.0

def test_over_stock_inflow_le_sale():
    # inflow <= sale -> 0
    assert compute_over_stock(10, 15, None, 24, 5) == 0.0
    assert compute_over_stock(10, 10, None, 24, 5) == 0.0

def test_over_stock_ref_comparison():
    # unsold <= ref -> 0
    assert compute_over_stock(31, 7, None, 24, 0) == 0.0
    assert compute_over_stock(20, 7, None, 24, 0) == 0.0

def test_over_stock_ref_none():
    # ref None -> None
    assert compute_over_stock(57, 7, None, None, 5) is None

def test_over_stock_regular_30d_none():
    # regular_30d None -> None
    assert compute_over_stock(57, 7, None, 24, None) is None

def test_over_stock_ref_zero():
    # ref 0 -> max(0, unsold - 0 - regular_30d) = 50 - 5 = 45
    assert compute_over_stock(57, 7, None, 0, 5) == 45.0
    assert compute_over_stock(57, 7, None, 0, 0) == 50.0

def test_over_stock_custom_example():
    # inflow 30, sale 10, ref 5, reg_30d 5 -> 30 - 10 - 5 - 5 = 10
    assert compute_over_stock(30, 10, None, 5, 5) == 10.0
    assert compute_over_stock_base(30, 10) == 20.0



