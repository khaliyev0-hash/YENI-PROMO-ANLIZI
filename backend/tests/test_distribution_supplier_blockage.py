import pytest
from app.distribution.supplier_blockage import is_supplier_blocked, normalize_text_token, get_sql_supplier_blockage_clause

def test_type_41_beli_is_blocked():
    # Various capitalizations and trailing spaces
    for b in ["beli", "BELI", "BELİ", " beli ", "BELİ ", "Beli\n"]:
        blocked, note = is_supplier_blocked(41, b)
        assert blocked is True, f"Failed for {repr(b)}"
        assert note == "BLOCKED_TYPE_41_BELI"
        
        # Test string type '41'
        blocked_str, _ = is_supplier_blocked("41", b)
        assert blocked_str is True

def test_type_41_xeyr_is_included():
    for x in ["xeyr", "XEYR", " XEYR ", "xeyr\t", "Xeyr"]:
        blocked, note = is_supplier_blocked(41, x)
        assert blocked is False, f"Failed for {repr(x)}"
        assert note is None

def test_type_40_always_included():
    # Regardless of blockage value, type 40 must never be blocked
    for b in ["beli", "BELI", "BELİ ", "xeyr", "XEYR", "UNKNOWN", None, ""]:
        blocked, note = is_supplier_blocked(40, b)
        assert blocked is False, f"Type 40 was blocked for {repr(b)}"

def test_type_42_always_included():
    for b in ["beli", "BELİ", "xeyr", "something_else", None]:
        blocked, _ = is_supplier_blocked(42, b)
        assert blocked is False

def test_type_44_always_included():
    for b in ["beli", "BELİ", "xeyr", "BLOCKED", None]:
        blocked, _ = is_supplier_blocked(44, b)
        assert blocked is False

def test_null_and_unexpected_values():
    # NULL supply type
    blocked, note = is_supplier_blocked(None, "beli")
    assert blocked is False
    assert note == "NULL_SUPPLY_TYPE"

    # Invalid supply type
    blocked, note = is_supplier_blocked("INVALID", "beli")
    assert blocked is False
    assert "INVALID_SUPPLY_TYPE" in note

    # Type 41 with unexpected blockage text (e.g. 'MUTLAQ', 'BILINMIR')
    blocked, note = is_supplier_blocked(41, "MUTLAQ")
    assert blocked is False
    assert "UNEXPECTED_BLOCKAGE_VALUE" in note

def test_sql_clause_syntax():
    clause = get_sql_supplier_blockage_clause()
    assert "TRY_CAST([IS YERI TEDARUK TIPI] AS INT) = 41" in clause
    assert "N'beli'" in clause
