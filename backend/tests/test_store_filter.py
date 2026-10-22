import pytest
import pandas as pd
from unittest.mock import MagicMock, patch

from app.db import get_active_store_codes, normalize_store_code
from app.watcher import compute_source_signature
from app.services.source_service import process_excel_file
import tempfile
import os

def test_synthetic_market_frame_filtering():
    """
    Test synthetic market dataframe covering:
    - AKTIV vs passive
    - TIP BLANK, MINI, REGION MINI excluded
    - NULL/empty TIP kept
    - whitespace, lowercase, and Azerbaijani 'AKTİV' variants
    - code format normalization ('ST-109', '000110')
    """
    data = [
        {"MAGAZA KODU": "101", "MAGAZA STATUSU": "AKTIV", "TIP": "SUPER", "MAGAZA": "Store 101"},
        {"MAGAZA KODU": "102", "MAGAZA STATUSU": "PASSIV", "TIP": "SUPER", "MAGAZA": "Store 102"},
        {"MAGAZA KODU": "103", "MAGAZA STATUSU": "AKTIV", "TIP": "MINI", "MAGAZA": "Store 103"},
        {"MAGAZA KODU": "104", "MAGAZA STATUSU": "AKTIV", "TIP": "BLANK", "MAGAZA": "Store 104"},
        {"MAGAZA KODU": "105", "MAGAZA STATUSU": "AKTIV", "TIP": "REGION MINI", "MAGAZA": "Store 105"},
        {"MAGAZA KODU": "106", "MAGAZA STATUSU": "AKTIV", "TIP": None, "MAGAZA": "Store 106"},
        {"MAGAZA KODU": "107", "MAGAZA STATUSU": "  aktiv  ", "TIP": "  city  ", "MAGAZA": "Store 107"},
        {"MAGAZA KODU": "108", "MAGAZA STATUSU": "AKTİV", "TIP": "SUPER+", "MAGAZA": "Store 108"},
        {"MAGAZA KODU": "ST-109", "MAGAZA STATUSU": "AKTIV", "TIP": "SUPER", "MAGAZA": "Store 109"},
        {"MAGAZA KODU": "000110", "MAGAZA STATUSU": "AKTIV", "TIP": "", "MAGAZA": "Store 110"},
    ]
    df_synthetic = pd.DataFrame(data)

    active_set, breakdown = get_active_store_codes(
        status_include=["AKTIV"],
        type_exclude=["BLANK", "MINI", "REGION MINI"],
        custom_df=df_synthetic
    )

    # Kept: 101, 106 (NULL tip), 107 (whitespace/lower), 108 (AKTİV), 109 (ST- prefix), 110 (empty tip + leading zeros)
    expected_kept = {"101", "106", "107", "108", "109", "110"}
    assert active_set == expected_kept
    assert set(breakdown["kept"]) == expected_kept

    # Dropped status: 102
    assert "102" in breakdown["dropped_status"]

    # Dropped type: 103 (MINI), 104 (BLANK), 105 (REGION MINI)
    assert set(breakdown["dropped_type"]) == {"103", "104", "105"}

    # NULL/empty TIP kept: 106, 110
    assert set(breakdown["null_type_kept"]) == {"106", "110"}
    assert breakdown["dropped_conflicting"] == []

def test_duplicates_agreeing_and_conflicting():
    """
    Test duplicate handling:
    - agreeing duplicate rows -> active
    - conflicting duplicate rows (status or type mismatch) -> not active, listed in dropped_conflicting
    """
    data = [
        # Store 201: Duplicate agreeing on status and type -> kept
        {"MAGAZA KODU": "201", "MAGAZA STATUSU": "AKTIV", "TIP": "SUPER", "MAGAZA": "Store 201 A"},
        {"MAGAZA KODU": "201", "MAGAZA STATUSU": "AKTIV", "TIP": "SUPER", "MAGAZA": "Store 201 B"},
        
        # Store 202: Duplicate conflicting on status (AKTIV vs DEAKTIV) -> dropped_conflicting
        {"MAGAZA KODU": "202", "MAGAZA STATUSU": "AKTIV", "TIP": "SUPER", "MAGAZA": "Store 202 A"},
        {"MAGAZA KODU": "202", "MAGAZA STATUSU": "DEAKTIV", "TIP": "SUPER", "MAGAZA": "Store 202 B"},

        # Store 203: Duplicate conflicting on TIP (SUPER vs MINI) -> dropped_conflicting
        {"MAGAZA KODU": "203", "MAGAZA STATUSU": "AKTIV", "TIP": "SUPER", "MAGAZA": "Store 203 A"},
        {"MAGAZA KODU": "203", "MAGAZA STATUSU": "AKTIV", "TIP": "MINI", "MAGAZA": "Store 203 B"},

        # Store 204: Duplicate agreeing on inactive status -> dropped_status
        {"MAGAZA KODU": "204", "MAGAZA STATUSU": "DEAKTIV", "TIP": "SUPER", "MAGAZA": "Store 204 A"},
        {"MAGAZA KODU": "204", "MAGAZA STATUSU": "DEAKTIV", "TIP": "SUPER", "MAGAZA": "Store 204 B"},
    ]
    df_synthetic = pd.DataFrame(data)

    active_set, breakdown = get_active_store_codes(
        status_include=["AKTIV"],
        type_exclude=["BLANK", "MINI", "REGION MINI"],
        custom_df=df_synthetic
    )

    assert active_set == {"201"}
    assert "201" in breakdown["kept"]
    assert set(breakdown["dropped_conflicting"]) == {"202", "203"}
    assert "204" in breakdown["dropped_status"]

def test_fail_closed_on_empty_or_zero_active():
    """
    Test fail-closed behavior:
    - Empty view dataframe -> raises RuntimeError
    - No active stores remaining -> raises RuntimeError
    """
    df_empty = pd.DataFrame(columns=["MAGAZA KODU", "MAGAZA STATUSU", "TIP", "MAGAZA"])
    with pytest.raises(RuntimeError, match="boşdur"):
        get_active_store_codes(custom_df=df_empty)

    df_no_active = pd.DataFrame([
        {"MAGAZA KODU": "101", "MAGAZA STATUSU": "DEAKTIV", "TIP": "SUPER"},
        {"MAGAZA KODU": "102", "MAGAZA STATUSU": "AKTIV", "TIP": "MINI"}
    ])
    with pytest.raises(RuntimeError, match="Aktiv mağaza tapılmadı"):
        get_active_store_codes(
            status_include=["AKTIV"],
            type_exclude=["MINI"],
            custom_df=df_no_active
        )

def test_fail_closed_on_db_query_error(monkeypatch):
    """
    Test that DB connection/query failures fail closed with clear error message.
    """
    def mock_get_conn():
        raise ConnectionError("Simulated DB timeout")

    monkeypatch.setattr("app.db.get_db_connection", mock_get_conn)
    with pytest.raises(RuntimeError, match="vw_TS_MARKET_DETAILS mağaza cədvəlini oxumaq mümkün olmadı"):
        get_active_store_codes(custom_df=None)

def test_excluded_stores_never_reach_db_query(monkeypatch):
    """
    Test that in process_excel_file:
    - Excluded stores are dropped before fetch_promo_sales_and_stock
    - Excluded stores never reach the store_codes IN list
    - DataQualityReport records STORE_FILTER and STORE_UNMATCHED warnings
    """
    # Create temp excel with stores 101 (active), 102 (MINI), 103 (inactive), 999 (unmatched)
    excel_data = {
        "STORE": ["101", "102", "103", "999"],
        "SKU": ["SKU1", "SKU1", "SKU1", "SKU1"],
        "PRODUCT_NAME": ["Item 1", "Item 1", "Item 1", "Item 1"],
        "FC": [100.0, 50.0, 30.0, 20.0],
        "START_DATE": ["2026-10-01", "2026-10-01", "2026-10-01", "2026-10-01"],
        "END_DATE": ["2026-10-05", "2026-10-05", "2026-10-05", "2026-10-05"]
    }
    df_excel = pd.DataFrame(excel_data)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        df_excel.to_excel(tmp_path, index=False)

        # Mock get_active_store_codes
        mock_active = {"101"}
        mock_breakdown = {
            "kept": ["101"],
            "dropped_status": ["103"],
            "dropped_type": ["102"],
            "dropped_conflicting": [],
            "null_type_kept": []
        }
        monkeypatch.setattr("app.services.source_service.get_active_store_codes", lambda: (mock_active, mock_breakdown))

        # Capture store_codes passed to fetch_promo_sales_and_stock
        captured_stores = []
        def mock_fetch(beg, end, item_codes, store_codes):
            nonlocal captured_stores
            captured_stores = store_codes
            return pd.DataFrame(columns=['store_code', 'item_code', 'sales_qty', 'current_stock', 'supplier_name'])

        monkeypatch.setattr("app.services.source_service.fetch_promo_sales_and_stock", mock_fetch)

        result = process_excel_file(tmp_path, trigger="test")

        # Verify ONLY store '101' reached DB query
        assert captured_stores == ["101"]

        # Verify warnings in quality report
        q_warnings = result["quality_report"]["warnings"]
        warning_types = [w["type"] for w in q_warnings]
        assert "STORE_FILTER" in warning_types
        assert "STORE_UNMATCHED" in warning_types

        # Verify STORE_FILTER details
        filter_w = next(w for w in q_warnings if w["type"] == "STORE_FILTER")
        assert filter_w["count"] == 3 # 3 rows dropped: 102, 103, 999
        assert "not AKTIV / TIP BLANK|MINI" in filter_w["description"]

        # Verify STORE_UNMATCHED details
        unmatched_w = next(w for w in q_warnings if w["type"] == "STORE_UNMATCHED")
        assert "999" in unmatched_w["description"]

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def test_source_signature_changes_when_rules_change(monkeypatch, tmp_path):
    """
    Test that compute_source_signature changes when store filter rules in config change.
    """
    dummy_file = tmp_path / "dummy.xlsx"
    dummy_file.write_bytes(b"test content")

    monkeypatch.setenv("DISABLE_ENV_FILE_OVERRIDE", "1")
    monkeypatch.setenv("STORE_STATUS_INCLUDE", "AKTIV")
    monkeypatch.setenv("STORE_TYPE_EXCLUDE", "BLANK,MINI")
    sig1 = compute_source_signature(str(dummy_file))

    # Same rules -> same signature
    sig1_repeat = compute_source_signature(str(dummy_file))
    assert sig1 == sig1_repeat

    # Change rule -> different signature
    monkeypatch.setenv("STORE_TYPE_EXCLUDE", "BLANK,MINI,REGION MINI")
    sig2 = compute_source_signature(str(dummy_file))
    assert sig1 != sig2
