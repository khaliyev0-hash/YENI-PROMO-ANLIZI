import math
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class OrderCalculationItem(BaseModel):
    store_code: str
    store_name: Optional[str] = None
    product_code: str
    product_name: str
    start_date: str
    end_date: str
    duration_days: int
    forecast_demand: float
    current_stock: float
    usable_current_stock: float
    eligible_incoming_stock: float = 0.0
    target_ending_stock: float = 0.0
    shelf_capacity: float
    net_requirement: float
    recommended_order_units: float
    case_quantity: float = 1.0
    recommended_cases: int = 0
    block_quantity: float = 1.0
    recommended_blocks: int = 0
    expected_ending_stock: float
    excess_units_from_rounding: float = 0.0
    warning_status: str = "OK"
    warning_message: Optional[str] = None
    unit: str = "ADET"
    barcode: Optional[str] = None
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    is_blocked: bool = False

def calculate_campaign_end_date(start_date: date, duration_days: int) -> date:
    """
    Inclusive date calculation:
    EndDate = StartDate + DurationDays - 1 day.
    E.g.: Start 2026-11-01 for 7 days -> End 2026-11-07.
    """
    if duration_days < 1:
        raise ValueError("DurationDays must be at least 1 day")
    return start_date + timedelta(days=duration_days - 1)

def calculate_net_order(
    store_code: str,
    product_code: str,
    product_name: str,
    start_date: str,
    end_date: str,
    duration_days: int,
    forecast_demand: float,
    current_stock: float,
    usable_current_stock: float,
    shelf_capacity: float,
    case_quantity: float = 1.0,
    block_quantity: float = 1.0,
    eligible_incoming_stock: float = 0.0,
    target_ending_stock: float = 0.0,
    store_name: Optional[str] = None,
    unit: str = "ADET",
    barcode: Optional[str] = None,
    supplier_code: Optional[str] = None,
    supplier_name: Optional[str] = None,
    is_blocked: bool = False,
    existing_warning: str = "OK",
    min_presentation_fill: bool = True
) -> OrderCalculationItem:
    """
    Computes retail net replenishment order per store × SKU:
    NetRequirement = max(0, ForecastDemand + TargetEndingStock - UsableCurrentStock - EligibleIncomingStock)
    
    Packaging Rounding Rules:
    - If CaseQuantity > 1: RecommendedCases = ceil(NetRequirement / CaseQuantity)
      RecommendedOrderUnits = RecommendedCases * CaseQuantity
    - Else If BlockQuantity > 1: RecommendedBlocks = ceil(NetRequirement / BlockQuantity)
      RecommendedOrderUnits = RecommendedBlocks * BlockQuantity
    - Else: RecommendedOrderUnits = ceil(NetRequirement)
    
    Zero-Stock Shelf Presentation Rule:
    - If a participating store has 0 available stock and positive ShelfCapacity:
      Guarantees at least minimum shelf presentation fill (at least 1 box / case pack or shelf facing)
      so the store does not enter the promotional period with an empty shelf.
    """
    # Blocked supplier handling
    if is_blocked:
        return OrderCalculationItem(
            store_code=store_code,
            store_name=store_name,
            product_code=product_code,
            product_name=product_name,
            start_date=start_date,
            end_date=end_date,
            duration_days=duration_days,
            forecast_demand=round(forecast_demand, 2),
            current_stock=round(current_stock, 2),
            usable_current_stock=0.0,
            eligible_incoming_stock=0.0,
            target_ending_stock=round(target_ending_stock, 2),
            shelf_capacity=round(shelf_capacity, 2),
            net_requirement=0.0,
            recommended_order_units=0.0,
            case_quantity=case_quantity,
            recommended_cases=0,
            block_quantity=block_quantity,
            recommended_blocks=0,
            expected_ending_stock=round(max(0.0, current_stock - forecast_demand), 2),
            excess_units_from_rounding=0.0,
            warning_status="SUPPLIER_BLOCKED",
            warning_message="Təchizatçı blokajı aktivdir (Tip 41 + BELI). Sifariş təyin edilmir.",
            unit=unit,
            barcode=barcode,
            supplier_code=supplier_code,
            supplier_name=supplier_name,
            is_blocked=True
        )

    cq = float(case_quantity) if case_quantity and float(case_quantity) > 0 else 1.0
    bq = float(block_quantity) if block_quantity and float(block_quantity) > 0 else 1.0

    # Net requirement formula: strictly follows Master Prompt section 10 (incoming stock excluded)
    gross_need = forecast_demand + target_ending_stock
    available_stock = usable_current_stock

    # If forecast is 0 (brand new item without history) but store has 0 stock and positive shelf capacity:
    if min_presentation_fill and available_stock <= 0 and shelf_capacity > 0 and forecast_demand <= 0:
        min_facing_need = min(shelf_capacity, cq)
        gross_need = max(gross_need, min_facing_need)

    net_req = max(0.0, gross_need - available_stock)

    # Packaging rounding
    cq = float(case_quantity) if case_quantity and float(case_quantity) > 0 else 1.0
    bq = float(block_quantity) if block_quantity and float(block_quantity) > 0 else 1.0

    rec_cases = 0
    rec_blocks = 0
    rec_units = 0.0

    if net_req > 0:
        if cq > 1.0:
            rec_cases = int(math.ceil(net_req / cq))
            rec_units = float(rec_cases * cq)
            rec_blocks = int(math.ceil(rec_units / bq)) if bq > 0 else 0
        elif bq > 1.0:
            rec_blocks = int(math.ceil(net_req / bq))
            rec_units = float(rec_blocks * bq)
            rec_cases = 0
        else:
            # ADET is discrete; KQ can be fractional if needed, but replenishment usually rounds
            rec_units = float(math.ceil(net_req)) if unit.upper() in ["ADET", "DƏNƏ", "ED"] else round(net_req, 2)
            rec_cases = int(math.ceil(rec_units))
            rec_blocks = int(math.ceil(rec_units))
    else:
        rec_cases = 0
        rec_blocks = 0
        rec_units = 0.0

    excess = max(0.0, rec_units - net_req)
    exp_ending = available_stock + rec_units - forecast_demand

    # Warnings evaluation
    warning = existing_warning
    warning_msg = None

    if warning in ["OK", "FALLBACK_NETWORK_AVG", "INITIAL_SHELF_FILL"]:
        if rec_units > shelf_capacity and shelf_capacity > 0:
            base_msg = f"Tövsiyə olunan sifariş ({rec_units}) rəf tutumunu ({shelf_capacity}) aşır. Arxa anbar sahəsi tələb olunur."
            if warning == "FALLBACK_NETWORK_AVG":
                base_msg += f" (Tarixi stok/satış 0 olduğu üçün şəbəkənin orta tələbatı {forecast_demand:.1f} tətbiq edildi)."
            elif warning == "INITIAL_SHELF_FILL":
                base_msg += " (Tarixi satış 0 olduğu üçün ilkin rəf doldurma tətbiq edildi)."
            warning_msg = base_msg
            if warning == "OK":
                warning = "EXCEEDS_SHELF_CAPACITY"
        elif excess > (0.5 * forecast_demand) and forecast_demand > 5:
            warning_msg = f"Qutu yuvarlaqlaşdırması nəticəsində yaranan artıq miqdar ({excess:.1f}) tələbatın 50%-dən çoxdur."
            if warning == "OK":
                warning = "ROUNDING_EXCESS_HIGH"
        elif forecast_demand <= 0 and current_stock <= 0:
            warning = "LOW_DATA_HISTORY"
            warning_msg = "Tarixi satış və cari stok qeydə alınmayıb."
        elif warning == "FALLBACK_NETWORK_AVG":
            warning_msg = f"Mağazada tarixi satış və ya stok olmadığı üçün şəbəkənin orta tələbatı ({forecast_demand:.1f}) tətbiq edildi."
        elif warning == "INITIAL_SHELF_FILL":
            warning_msg = "Satış tarixçəsi yoxdur, mağazada stok 0 olduğu üçün minimum rəf doldurma təyin edildi."

    return OrderCalculationItem(
        store_code=store_code,
        store_name=store_name,
        product_code=product_code,
        product_name=product_name,
        start_date=start_date,
        end_date=end_date,
        duration_days=duration_days,
        forecast_demand=round(forecast_demand, 2),
        current_stock=round(current_stock, 2),
        usable_current_stock=round(usable_current_stock, 2),
        eligible_incoming_stock=0.0,
        target_ending_stock=round(target_ending_stock, 2),
        shelf_capacity=round(shelf_capacity, 2),
        net_requirement=round(net_req, 2),
        recommended_order_units=round(rec_units, 2),
        case_quantity=round(cq, 2),
        recommended_cases=rec_cases,
        block_quantity=round(bq, 2),
        recommended_blocks=rec_blocks,
        expected_ending_stock=round(exp_ending, 2),
        excess_units_from_rounding=round(excess, 2),
        warning_status=warning,
        warning_message=warning_msg,
        unit=unit,
        barcode=barcode,
        supplier_code=supplier_code,
        supplier_name=supplier_name,
        is_blocked=False
    )
