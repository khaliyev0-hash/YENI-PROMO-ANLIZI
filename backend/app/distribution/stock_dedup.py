from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field
from app.distribution.supplier_blockage import is_supplier_blocked

class StockDeduplicationResult(BaseModel):
    store_code: str
    product_code: str
    product_name: str
    current_stock: float
    usable_current_stock: float
    eligible_incoming_stock: float = 0.0
    warehouse_stock: float = 0.0
    case_quantity: float = 1.0  # QUTU ICI
    block_quantity: float = 1.0 # BLOK ICI
    unit: str = "ADET"
    barcode: Optional[str] = None
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    supply_type: Optional[int] = None
    blockage_status: Optional[str] = None
    is_blocked: bool = False
    warning_status: str = "OK"

class DistributionException(BaseModel):
    store_code: str
    product_code: str
    product_name: Optional[str] = None
    exception_type: str  # SUPPLIER_BLOCKED, STOCK_CONFLICT, MISSING_MASTER_DATA, etc.
    description: str
    source: str = "vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING"
    affected_calculations: str = "Order calculation excluded or defaulted to zero"
    proposed_resolution: str

def process_and_deduplicate_stock_rows(
    raw_rows: List[Dict[str, Any]]
) -> Tuple[Dict[Tuple[str, str], StockDeduplicationResult], List[DistributionException]]:
    """
    Processes raw rows from vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING.
    Groups by (store_code, product_code).
    
    Rules:
    1. Filter out blocked supplier rows using is_supplier_blocked(supply_type, blockage).
    2. Check stock consistency across duplicate rows.
       - If stock values differ significantly (> 0.001) among valid rows:
         Flag STOCK_CONFLICT exception, do NOT sum or guess.
    3. If ALL rows are blocked:
       Flag SUPPLIER_BLOCKED exception, usable_current_stock = 0.0, is_blocked = True.
    4. When unblocked row(s) exist:
       Take verified physical stock (first unblocked row's stock, as all physical stock lines are identical).
       Extract packaging QUTU ICI and BLOK ICI from the primary unblocked supplier.
    """
    grouped: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    for r in raw_rows:
        st = str(r.get("IS YERI NO") or r.get("store_code") or "").strip()
        sku = str(r.get("URUN KODU") or r.get("product_code") or "").strip()
        if not st or not sku:
            continue
        grouped.setdefault((st, sku), []).append(r)

    results: Dict[Tuple[str, str], StockDeduplicationResult] = {}
    exceptions: List[DistributionException] = []

    for (st, sku), rows in grouped.items():
        first_row = rows[0]
        prod_name = str(first_row.get("URUN AD") or first_row.get("product_name") or sku).strip()

        # Partition rows into unblocked and blocked
        unblocked_rows: List[Tuple[Dict[str, Any], Optional[str]]] = []
        blocked_rows: List[Tuple[Dict[str, Any], Optional[str]]] = []

        for row in rows:
            sup_type = row.get("IS YERI TEDARUK TIPI") or row.get("supply_type")
            blk_val = row.get("TEDARİKCİ BLOKAJİ") or row.get("TEDARIKCI BLOKAJI") or row.get("blockage")
            
            is_blocked, note = is_supplier_blocked(sup_type, blk_val)
            if is_blocked:
                blocked_rows.append((row, note))
            else:
                unblocked_rows.append((row, note))

        # Check if ALL rows were blocked
        if not unblocked_rows:
            # Entire product cannot be supplied to this store due to supplier blockage
            raw_stk = first_row.get("Stok miqdari") or first_row.get("current_stock")
            phys_stock = float(raw_stk) if raw_stk is not None and str(raw_stk).strip() != "" and str(raw_stk).lower() != "none" else 0.0
            
            sup_code = str(first_row.get("SATICI") or "")
            sup_name = str(first_row.get("SATICI ADI") or "")
            
            exceptions.append(DistributionException(
                store_code=st,
                product_code=sku,
                product_name=prod_name,
                exception_type="SUPPLIER_BLOCKED",
                description=f"Təchizatçı blokajı aktivdir (Tip 41 + BELI). Təchizatçı: {sup_code} - {sup_name}",
                source="vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING",
                affected_calculations="Mağazaya bu məhsul üzrə sifariş təyin edilmir (Tövsiyə olunan sifariş = 0).",
                proposed_resolution="Təchizat şöbəsi ilə əlaqə saxlayaraq mağaza üçün təchizatçı blokajını aradan qaldırın."
            ))

            results[(st, sku)] = StockDeduplicationResult(
                store_code=st,
                product_code=sku,
                product_name=prod_name,
                current_stock=phys_stock,
                usable_current_stock=0.0,  # Blocked from supply
                is_blocked=True,
                warning_status="SUPPLIER_BLOCKED",
                supplier_code=sup_code,
                supplier_name=sup_name
            )
            continue

        # Inspect unblocked rows for stock consistency
        stock_values = []
        for row, _ in unblocked_rows:
            raw_stk = row.get("Stok miqdari") or row.get("current_stock")
            if raw_stk is not None and str(raw_stk).strip() != "" and str(raw_stk).lower() != "none":
                try:
                    stock_values.append(float(raw_stk))
                except (ValueError, TypeError):
                    pass
            else:
                stock_values.append(0.0)

        min_stk = min(stock_values) if stock_values else 0.0
        max_stk = max(stock_values) if stock_values else 0.0

        # Check for stock conflict
        has_conflict = (max_stk - min_stk) > 0.001
        warning = "OK"

        if has_conflict:
            exceptions.append(DistributionException(
                store_code=st,
                product_code=sku,
                product_name=prod_name,
                exception_type="STOCK_CONFLICT",
                description=f"Eyni mağaza-məhsul cütü üçün fərqli stok qeydləri aşkarlandı: Min={min_stk}, Max={max_stk}",
                source="vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING",
                affected_calculations="Düzgün sifariş hesablaması üçün ehtiyat tədbiri olaraq maksimum stok qəbul edilir.",
                proposed_resolution="ERP-də mağazanın anbar/anbaraltı qalıqlarını və təchizatçı kartlarını dəqiqləşdirin."
            ))
            warning = "STOCK_CONFLICT"

        # Adopt verified physical stock
        primary_row, _ = unblocked_rows[0]
        chosen_stock = max_stk if has_conflict else (stock_values[0] if stock_values else 0.0)

        # Incoming stock (SIFARIS in view)
        raw_incoming = primary_row.get("SIFARIS")
        incoming_stock = float(raw_incoming) if raw_incoming is not None and str(raw_incoming).strip() != "" and str(raw_incoming).lower() != "none" else 0.0

        # Warehouse stock
        raw_depo = primary_row.get("Depo stoku")
        wh_stock = float(raw_depo) if raw_depo is not None and str(raw_depo).strip() != "" and str(raw_depo).lower() != "none" else 0.0

        # Packaging units with robust error handling
        raw_case = primary_row.get("QUTU ICI")
        try:
            case_qty = float(raw_case) if raw_case is not None and str(raw_case).strip() != "" and float(raw_case) > 0 else 1.0
        except (ValueError, TypeError):
            case_qty = 1.0

        raw_block = primary_row.get("BLOK ICI")
        try:
            block_qty = float(raw_block) if raw_block is not None and str(raw_block).strip() != "" and float(raw_block) > 0 else 1.0
        except (ValueError, TypeError):
            block_qty = 1.0

        unit = str(primary_row.get("VAHIDI") or "ADET").strip()
        barcode = str(primary_row.get("ESAS BARKOD") or "").strip()
        sup_code = str(primary_row.get("SATICI") or "").strip()
        sup_name = str(primary_row.get("SATICI ADI") or "").strip()
        st_type_val = primary_row.get("IS YERI TEDARUK TIPI")

        results[(st, sku)] = StockDeduplicationResult(
            store_code=st,
            product_code=sku,
            product_name=prod_name,
            current_stock=chosen_stock,
            usable_current_stock=chosen_stock,
            eligible_incoming_stock=incoming_stock,
            warehouse_stock=wh_stock,
            case_quantity=case_qty,
            block_quantity=block_qty,
            unit=unit,
            barcode=barcode if barcode else None,
            supplier_code=sup_code if sup_code else None,
            supplier_name=sup_name if sup_name else None,
            supply_type=int(st_type_val) if st_type_val is not None and str(st_type_val).isdigit() else None,
            warning_status=warning
        )

    return results, exceptions
