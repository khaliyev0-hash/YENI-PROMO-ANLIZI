import pytest
from app.distribution.stock_dedup import process_and_deduplicate_stock_rows

def test_deduplication_does_not_sum_identical_stock():
    # 2 rows for Store '101', SKU '100003' because of 2 suppliers, each showing stock = 8.0
    raw_data = [
        {
            "IS YERI NO": "101",
            "URUN KODU": "100003",
            "URUN AD": "AHMAD TEA 100G",
            "SATICI": "500001",
            "SATICI ADI": "SUPPLIER A",
            "IS YERI TEDARUK TIPI": 41,
            "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 8.0,
            "QUTU ICI": 24.0,
            "BLOK ICI": 1.0
        },
        {
            "IS YERI NO": "101",
            "URUN KODU": "100003",
            "URUN AD": "AHMAD TEA 100G",
            "SATICI": "500002",
            "SATICI ADI": "SUPPLIER B",
            "IS YERI TEDARUK TIPI": 41,
            "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 8.0,
            "QUTU ICI": 24.0,
            "BLOK ICI": 1.0
        }
    ]

    results, exceptions = process_and_deduplicate_stock_rows(raw_data)
    assert len(results) == 1
    assert len(exceptions) == 0

    res = results[("101", "100003")]
    # Stock must be exactly 8.0, NEVER 16.0!
    assert res.current_stock == 8.0
    assert res.usable_current_stock == 8.0
    assert res.case_quantity == 24.0
    assert res.warning_status == "OK"

def test_filter_out_blocked_supplier_row():
    # Row 1 is blocked (41 + BELI), Row 2 is unblocked (41 + XEYR)
    raw_data = [
        {
            "IS YERI NO": "102",
            "URUN KODU": "102414",
            "URUN AD": "MERLOT WINE",
            "SATICI": "500393",
            "SATICI ADI": "AVRORA ARAQ",
            "IS YERI TEDARUK TIPI": 41,
            "TEDARİKCİ BLOKAJİ": "BELI",
            "Stok miqdari": 5.0,
            "QUTU ICI": 6.0
        },
        {
            "IS YERI NO": "102",
            "URUN KODU": "102414",
            "URUN AD": "MERLOT WINE",
            "SATICI": "500011",
            "SATICI ADI": "AVRORA ELIT",
            "IS YERI TEDARUK TIPI": 41,
            "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 5.0,
            "QUTU ICI": 6.0
        }
    ]

    results, exceptions = process_and_deduplicate_stock_rows(raw_data)
    assert len(results) == 1
    assert len(exceptions) == 0

    res = results[("102", "102414")]
    assert res.is_blocked is False
    assert res.current_stock == 5.0
    assert res.usable_current_stock == 5.0
    assert res.supplier_code == "500011"

def test_all_suppliers_blocked_logs_exception():
    raw_data = [
        {
            "IS YERI NO": "103",
            "URUN KODU": "105557",
            "URUN AD": "DR SANTE SHAMPOO",
            "SATICI": "500187",
            "SATICI ADI": "KARVAN 2002",
            "IS YERI TEDARUK TIPI": 41,
            "TEDARİKCİ BLOKAJİ": "BELI",
            "Stok miqdari": 2.0
        }
    ]

    results, exceptions = process_and_deduplicate_stock_rows(raw_data)
    assert len(results) == 1
    assert len(exceptions) == 1

    res = results[("103", "105557")]
    assert res.is_blocked is True
    assert res.usable_current_stock == 0.0
    assert res.warning_status == "SUPPLIER_BLOCKED"

    exc = exceptions[0]
    assert exc.exception_type == "SUPPLIER_BLOCKED"
    assert exc.store_code == "103"
    assert exc.product_code == "105557"

def test_stock_conflict_logs_exception():
    # 2 rows with differing stock values (e.g. 5.0 vs 15.0)
    raw_data = [
        {
            "IS YERI NO": "104",
            "URUN KODU": "999999",
            "URUN AD": "CONFLICTING ITEM",
            "IS YERI TEDARUK TIPI": 40,
            "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 5.0
        },
        {
            "IS YERI NO": "104",
            "URUN KODU": "999999",
            "URUN AD": "CONFLICTING ITEM",
            "IS YERI TEDARUK TIPI": 40,
            "TEDARİKCİ BLOKAJİ": "XEYR",
            "Stok miqdari": 15.0
        }
    ]

    results, exceptions = process_and_deduplicate_stock_rows(raw_data)
    assert len(results) == 1
    assert len(exceptions) == 1

    res = results[("104", "999999")]
    assert res.warning_status == "STOCK_CONFLICT"
    assert res.current_stock == 15.0 # safely takes max to prevent over-ordering

    exc = exceptions[0]
    assert exc.exception_type == "STOCK_CONFLICT"
