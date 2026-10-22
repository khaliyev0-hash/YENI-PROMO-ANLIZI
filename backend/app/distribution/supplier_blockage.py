import re
from typing import Optional, Union, Tuple

def normalize_text_token(val: Optional[Union[str, int, float]]) -> str:
    """
    Normalizes text for case-insensitive and locale-safe comparison.
    Handles Turkish/Azerbaijani dotted/dotless I correctly:
    'İ' -> 'i', 'I' -> 'i' / 'ı'.
    Strips whitespace.
    """
    if val is None:
        return ""
    s = str(val).strip()
    # Normalize Turkish dotted I and dotless I
    s = s.replace("İ", "i").replace("I", "ı").replace("ı", "i")
    return s.lower()

def is_supplier_blocked(
    supply_type: Optional[Union[int, str]], 
    blockage: Optional[Union[str, int, float]]
) -> Tuple[bool, Optional[str]]:
    """
    Business Rule for Supplier Blockage (Təchizatçı Blokajı):
    - Supply Type (IS YERI TEDARUK TIPI): known values 40, 41, 42, 44.
    - Rule: ONLY (IS YERI TEDARUK TIPI = 41 AND TEDARIKCI BLOKAJI = 'beli') is excluded/blocked.
    - Supply types 40, 42, 44: always included regardless of blockage value.
    - Supply type 41 with 'XEYR': included.
    
    Returns:
        (is_blocked: bool, note_or_exception: Optional[str])
    """
    if supply_type is None or str(supply_type).strip() == "" or str(supply_type).strip().lower() in ["none", "nan", "null"]:
        return False, "NULL_SUPPLY_TYPE"

    try:
        st_num = int(float(str(supply_type).strip()))
    except (ValueError, TypeError):
        return False, f"INVALID_SUPPLY_TYPE_{supply_type}"

    norm_block = normalize_text_token(blockage)

    # Only type 41 with 'beli' is blocked
    if st_num == 41:
        if norm_block == "beli":
            return True, "BLOCKED_TYPE_41_BELI"
        elif norm_block in ["xeyr", "x", "no", "false", "0", ""]:
            return False, None
        else:
            # Unexpected blockage value under type 41
            return False, f"UNEXPECTED_BLOCKAGE_VALUE_{blockage}"
    
    # Types 40, 42, 44 (or any other known supply types) are never blocked by supplier blockage
    return False, None

def get_sql_supplier_blockage_clause(
    type_col: str = "[IS YERI TEDARUK TIPI]",
    blockage_col: str = "[TEDARİKCİ BLOKAJİ]"
) -> str:
    """
    Generates production-grade SQL Server WHERE predicate.
    Excludes ONLY rows where supply type = 41 and blockage = 'beli'.
    """
    return f"""NOT (
        TRY_CAST({type_col} AS INT) = 41
        AND LOWER(LTRIM(RTRIM(REPLACE(REPLACE(CAST(ISNULL({blockage_col}, '') AS NVARCHAR(50)), N'İ', N'i'), N'I', N'ı')))) IN (N'beli', N'belı')
    )"""
