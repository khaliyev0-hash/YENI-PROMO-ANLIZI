import os
import pyodbc
from typing import Dict, Any, List, Set, Tuple, Optional
from datetime import date, datetime, timedelta
import pandas as pd
from app.db import get_db_connection

def query_stock_details_for_skus(
    product_codes: List[str],
    store_codes: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Fetches raw stock, packaging, and supplier blockage data for selected SKUs.
    Fast indexed query: uses WHERE [URUN KODU] IN (...).
    """
    if not product_codes:
        return []

    # Clean product codes
    clean_skus = list(set(str(c).strip() for c in product_codes if c and str(c).strip()))
    if not clean_skus:
        return []

    conn = get_db_connection()
    cursor = conn.cursor()

    # Query in batches of 500 to stay well under SQL Server parameter limit (2100)
    batch_size = 500
    all_rows: List[Dict[str, Any]] = []

    try:
        for i in range(0, len(clean_skus), batch_size):
            sku_batch = clean_skus[i:i + batch_size]
            placeholders = ",".join(["?"] * len(sku_batch))
            
            store_filter = ""
            params: List[Any] = list(sku_batch)
            if store_codes:
                clean_stores = list(set(str(s).strip() for s in store_codes if s and str(s).strip()))
                if clean_stores:
                    st_placeholders = ",".join(["?"] * len(clean_stores))
                    store_filter = f"AND LTRIM(RTRIM(CAST([IS YERI NO] AS VARCHAR(20)))) IN ({st_placeholders})"
                    params.extend(clean_stores)

            sql = f"""
            SELECT 
                LTRIM(RTRIM(CAST([IS YERI NO] AS VARCHAR(20)))) AS [IS YERI NO],
                LTRIM(RTRIM(CAST([URUN KODU] AS VARCHAR(50)))) AS [URUN KODU],
                [URUN AD],
                LTRIM(RTRIM(CAST([SATICI] AS VARCHAR(50)))) AS [SATICI],
                [SATICI ADI],
                [IS YERI TEDARUK TIPI],
                [TEDARİKCİ BLOKAJİ],
                [Stok miqdari],
                [Depo stoku],
                [SIFARIS],
                [QUTU ICI],
                [BLOK ICI],
                [VAHIDI],
                [ESAS BARKOD]
            FROM vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING WITH (NOLOCK)
            WHERE LTRIM(RTRIM(CAST([URUN KODU] AS VARCHAR(50)))) IN ({placeholders})
            {store_filter}
            """
            cursor.execute(sql, params)
            cols = [col[0] for col in cursor.description]
            for row in cursor.fetchall():
                all_rows.append(dict(zip(cols, row)))
    finally:
        cursor.close()
        conn.close()

    return all_rows

def query_sales_history_and_forecast(
    product_codes: List[str],
    store_codes: List[str],
    campaign_start: date,
    duration_days: int,
    history_days: int = 30,
    stockout_correction: bool = False,
    promo_uplift_pct: float = 0.0,
    stockout_history_available: bool = False
) -> Tuple[Dict[Tuple[str, str], float], Dict[str, float]]:
    """
    Queries historical sales from fnc_TS_SALES_REPORT_FOR_PLANNING for the given SKUs and stores.
    History range: [campaign_start - history_days, campaign_start - 1 day].
    
    Demand forecasting calculation (Safe baseline without daily historical stock):
    - Verifies the full 30-calendar-day window: calendar_days = (hist_end - hist_start) + 1.
    - Since SQL Server does NOT store daily historical stock snapshots (stockout_history_available=False),
      we strictly DO NOT assume non-sale days were out-of-stock. Stockout correction is deactivated (False).
    - ADS30 = TotalSalesLast30CalendarDays / 30 calendar days.
    - CurrentTrend = ADS30 * duration_days.
    - Promo Uplift: scales demand by (1 + promo_uplift_pct / 100).
    - Network Average Fallback: computes average forecast across selling stores for stores with 0 sales.
    
    Returns:
        (sales_map: Dict[(store, sku), forecast], network_averages: Dict[sku, avg_forecast])
    """
    if not product_codes or not store_codes:
        return {}, {}

    clean_skus = list(set(str(c).strip() for c in product_codes if c and str(c).strip()))
    clean_stores = set(str(s).strip() for s in store_codes if s and str(s).strip())

    effective_history_days = max(1, int(history_days))
    effective_duration = max(1, int(duration_days))
    hist_end = campaign_start - timedelta(days=1)
    hist_start = hist_end - timedelta(days=effective_history_days - 1)
    history_calendar_days = max(1, (hist_end - hist_start).days + 1)

    hist_start_str = hist_start.strftime("%Y-%m-%d")
    hist_end_str = hist_end.strftime("%Y-%m-%d")

    conn = get_db_connection()
    cursor = conn.cursor()

    batch_size = 500
    sales_map: Dict[Tuple[str, str], float] = {}
    sku_store_forecasts: Dict[str, List[float]] = {}

    try:
        for i in range(0, len(clean_skus), batch_size):
            sku_batch = clean_skus[i:i + batch_size]
            placeholders = ",".join(["?"] * len(sku_batch))

            sql = f"""
            SELECT 
                LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))) AS store_code,
                LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50)))) AS item_code,
                SUM(CAST(ISNULL(MIQDARI, 0) AS FLOAT)) as total_sales_qty,
                COUNT(DISTINCT CAST(TARIX AS DATE)) as active_sale_days
            FROM fnc_TS_SALES_REPORT_FOR_PLANNING('{hist_start_str}', '{hist_end_str}')
            WHERE LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50)))) IN ({placeholders})
            GROUP BY LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))), LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50))))
            """
            cursor.execute(sql, sku_batch)
            for row in cursor.fetchall():
                st = str(row[0]).strip()
                sku = str(row[1]).strip()
                if clean_stores and st not in clean_stores:
                    continue
                tot_qty = float(row[2]) if row[2] is not None else 0.0
                active_days = int(row[3]) if row[3] is not None else 0
                
                # Rule 1, 2, 4, 16: Safe Baseline ADS30 across all calendar days
                # Do NOT guess active days without daily stock history.
                if stockout_history_available and stockout_correction and active_days > 0:
                    effective_days = max(1, min(active_days, history_calendar_days))
                    ads = max(0.0, tot_qty) / float(effective_days)
                else:
                    ads = max(0.0, tot_qty) / float(history_calendar_days)

                # Apply Promo Uplift percentage
                uplift_mult = 1.0 + (max(0.0, float(promo_uplift_pct)) / 100.0)
                projected_demand = ads * float(effective_duration) * uplift_mult
                sales_map[(st, sku)] = round(projected_demand, 2)
                if projected_demand > 0:
                    sku_store_forecasts.setdefault(sku, []).append(projected_demand)
    except Exception as e:
        print(f"Warning: fnc_TS_SALES_REPORT_FOR_PLANNING query encountered: {e}")
    finally:
        cursor.close()
        conn.close()

    # Compute network average forecast per SKU among selling stores
    network_averages: Dict[str, float] = {}
    for sku, fc_list in sku_store_forecasts.items():
        if fc_list:
            network_averages[sku] = round(sum(fc_list) / len(fc_list), 2)

    return sales_map, network_averages

class YoySalesDict(dict):
    """Dictionary that can hold disqualified_stores metadata."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.disqualified_stores: Dict[str, Dict[str, Any]] = {}

class YoyResultTuple(tuple):
    """
    Two-element tuple (yoy_sales_map, yoy_promo_map) for 100% backward compatibility
    with standard tuple unpacking, while also exposing disqualified_stores.
    """
    def __new__(cls, yoy_sales_map, yoy_promo_map, disqualified_stores=None):
        return super().__new__(cls, (yoy_sales_map, yoy_promo_map))
    
    def __init__(self, yoy_sales_map, yoy_promo_map, disqualified_stores=None):
        self.yoy_sales_map = yoy_sales_map
        self.yoy_promo_map = yoy_promo_map
        self.disqualified_stores = disqualified_stores or {}

def query_yoy_sales_history(
    product_codes: List[str],
    store_codes: Optional[List[str]],
    campaign_start: date,
    duration_days: int,
    yoy_years_back: int = 1
) -> Tuple[Dict[Tuple[str, str], float], Dict[Tuple[str, str], float]]:
    """
    Queries past year sales (2025, 2024, etc.) from dbo.fnc_TS_SALES_REPORT_FOR_PLANNING_UNION.
    Uses 52-week calendar alignment (364 days * yoy_years_back) so day-of-week
    (Monday to Sunday) matches the planned campaign window perfectly.
    
    Smart Store History Maturity Rule:
    - Verifies whether each store was actively open for at least 70% of the duration
      in the historical YoY period.
    - If a store opened during or at the end of the YoY window (e.g. Store 193 opened 05.11.2025),
      its historical sales are disqualified to prevent artificially suppressing or inflating
      demand forecasts.
    
    Returns:
        (yoy_sales_map: Dict[(store, sku), total_sales_qty],
         yoy_promo_map: Dict[(store, sku), promo_sales_qty])
    """
    if not product_codes:
        return YoyResultTuple({}, {})

    clean_skus = list(set(str(c).strip() for c in product_codes if c and str(c).strip()))
    clean_stores = set(str(s).strip() for s in store_codes if s and str(s).strip()) if store_codes else None

    # 52 weeks = 364 days per year back ensures exact day-of-week alignment
    days_back = 364 * max(1, yoy_years_back)
    yoy_start = campaign_start - timedelta(days=days_back)
    yoy_end = yoy_start + timedelta(days=duration_days - 1)

    yoy_start_str = yoy_start.strftime("%Y-%m-%d")
    yoy_end_str = yoy_end.strftime("%Y-%m-%d")

    conn = get_db_connection()
    cursor = conn.cursor()

    batch_size = 500
    yoy_sales_map: Dict[Tuple[str, str], float] = {}
    yoy_promo_map: Dict[Tuple[str, str], float] = {}
    disqualified_stores: Dict[str, Dict[str, Any]] = {}

    try:
        # Step 1: Store History Maturity Check
        # Ensure stores had genuine ongoing sales in that window rather than an opening-day spike
        min_required_days = max(3, int(duration_days * 0.7))
        try:
            if clean_stores:
                store_list = list(clean_stores)
                st_batch_size = 200
                for s_idx in range(0, len(store_list), st_batch_size):
                    sub_stores = store_list[s_idx:s_idx + st_batch_size]
                    st_placeholders = ",".join(["?"] * len(sub_stores))
                    st_sql = f"""
                    SELECT 
                        LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))) AS store_code,
                        COUNT(DISTINCT TARIX) as active_store_days,
                        MIN(TARIX) as first_sale_date,
                        MAX(TARIX) as last_sale_date
                    FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING_UNION('{yoy_start_str}', '{yoy_end_str}')
                    WHERE LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))) IN ({st_placeholders})
                    GROUP BY LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20))))
                    """
                    cursor.execute(st_sql, sub_stores)
                    seen_stores = set()
                    for st_row in cursor.fetchall():
                        s_code = str(st_row[0]).strip()
                        act_days = int(st_row[1]) if st_row[1] is not None else 0
                        first_dt = str(st_row[2]) if st_row[2] is not None else ""
                        seen_stores.add(s_code)
                        
                        if act_days < min_required_days:
                            disqualified_stores[s_code] = {
                                "active_days": act_days,
                                "required_days": min_required_days,
                                "first_sale_date": first_dt,
                                "reason": f"Mağaza ({s_code}) keçən il bu dövrdə cəmi {act_days} gün fəaliyyət göstərib (ilk satış: {first_dt}, tələb olunan: ən azı {min_required_days} gün). Təhrifin qarşısını almaq üçün YoY deaktiv edildi və 100% cari satış trendi tətbiq edildi."
                            }
                    
                    for s_code in sub_stores:
                        if s_code not in seen_stores:
                            disqualified_stores[s_code] = {
                                "active_days": 0,
                                "required_days": min_required_days,
                                "first_sale_date": None,
                                "reason": f"Mağaza ({s_code}) keçən il bu dövrdə heç bir satış qeydiyyatına malik olmayıb (yeni açılmış mağaza). YoY deaktiv edildi və 100% cari satış trendi tətbiq edildi."
                            }
            else:
                st_sql = f"""
                SELECT 
                    LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))) AS store_code,
                    COUNT(DISTINCT TARIX) as active_store_days,
                    MIN(TARIX) as first_sale_date,
                    MAX(TARIX) as last_sale_date
                FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING_UNION('{yoy_start_str}', '{yoy_end_str}')
                GROUP BY LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20))))
                """
                cursor.execute(st_sql)
                for st_row in cursor.fetchall():
                    s_code = str(st_row[0]).strip()
                    act_days = int(st_row[1]) if st_row[1] is not None else 0
                    first_dt = str(st_row[2]) if st_row[2] is not None else ""
                    if act_days < min_required_days:
                        disqualified_stores[s_code] = {
                            "active_days": act_days,
                            "required_days": min_required_days,
                            "first_sale_date": first_dt,
                            "reason": f"Mağaza ({s_code}) keçən il bu dövrdə cəmi {act_days} gün fəaliyyət göstərib (ilk satış: {first_dt}, tələb olunan: ən azı {min_required_days} gün). Təhrifin qarşısını almaq üçün YoY deaktiv edildi və 100% cari satış trendi tətbiq edildi."
                        }
        except Exception as st_err:
            print(f"Warning: Store maturity check encountered: {st_err}")

        # Step 2: Fetch SKU sales history
        for i in range(0, len(clean_skus), batch_size):
            sku_batch = clean_skus[i:i + batch_size]
            placeholders = ",".join(["?"] * len(sku_batch))

            sql = f"""
            SELECT 
                LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))) AS store_code,
                LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50)))) AS item_code,
                SUM(CAST(ISNULL(MIQDARI, 0) AS FLOAT)) as total_sales_qty,
                SUM(CAST(ISNULL(INSERT_MIQDARI, 0) AS FLOAT)) as promo_sales_qty
            FROM dbo.fnc_TS_SALES_REPORT_FOR_PLANNING_UNION('{yoy_start_str}', '{yoy_end_str}')
            WHERE LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50)))) IN ({placeholders})
            GROUP BY LTRIM(RTRIM(CAST(MAGAZA AS VARCHAR(20)))), LTRIM(RTRIM(CAST(MEHSUL_KODU AS VARCHAR(50))))
            """
            cursor.execute(sql, sku_batch)
            for row in cursor.fetchall():
                st = str(row[0]).strip()
                sku = str(row[1]).strip()
                if clean_stores and st not in clean_stores:
                    continue
                # If store has disqualified YoY history, skip populating to avoid distortion
                if st in disqualified_stores:
                    continue
                tot = float(row[2]) if row[2] is not None else 0.0
                prm = float(row[3]) if row[3] is not None else 0.0
                yoy_sales_map[(st, sku)] = round(tot, 2)
                yoy_promo_map[(st, sku)] = round(prm, 2)
    except Exception as e:
        print(f"Warning: fnc_TS_SALES_REPORT_FOR_PLANNING_UNION query encountered: {e}")
    finally:
        cursor.close()
        conn.close()

    yoy_sales_dict = YoySalesDict(yoy_sales_map)
    yoy_sales_dict.disqualified_stores = disqualified_stores
    return YoyResultTuple(yoy_sales_dict, yoy_promo_map, disqualified_stores)

def cross_validate_with_master_data(
    excel_rows: List[Any]
) -> Tuple[List[Any], List[Dict[str, Any]]]:
    """
    Validates uploaded Excel codes against database master records:
    - Detects unknown product codes.
    - Detects product name mismatches.
    - Detects unknown store codes.
    """
    if not excel_rows:
        return [], []

    skus = list(set(r.product_code for r in excel_rows))
    stores = list(set(r.store_code for r in excel_rows))

    conn = get_db_connection()
    cursor = conn.cursor()

    db_products: Dict[str, str] = {}
    db_stores: Set[str] = set()

    try:
        # Check products in batches
        for i in range(0, len(skus), 500):
            batch = skus[i:i + 500]
            pl = ",".join(["?"] * len(batch))
            cursor.execute(f"""
                SELECT DISTINCT 
                    LTRIM(RTRIM(CAST([URUN KODU] AS VARCHAR(50)))),
                    LTRIM(RTRIM([URUN AD]))
                FROM vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING WITH (NOLOCK)
                WHERE LTRIM(RTRIM(CAST([URUN KODU] AS VARCHAR(50)))) IN ({pl})
            """, batch)
            for r in cursor.fetchall():
                if r[0]:
                    db_products[str(r[0]).strip()] = str(r[1]).strip() if r[1] else ""

        # Check stores
        for i in range(0, len(stores), 500):
            batch = stores[i:i + 500]
            pl = ",".join(["?"] * len(batch))
            cursor.execute(f"""
                SELECT DISTINCT LTRIM(RTRIM(CAST([IS YERI NO] AS VARCHAR(20))))
                FROM vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING WITH (NOLOCK)
                WHERE LTRIM(RTRIM(CAST([IS YERI NO] AS VARCHAR(20)))) IN ({pl})
            """, batch)
            for r in cursor.fetchall():
                if r[0]:
                    db_stores.add(str(r[0]).strip())
    finally:
        cursor.close()
        conn.close()

    validated_rows = []
    discrepancies: List[Dict[str, Any]] = []

    for r in excel_rows:
        st = r.store_code
        sku = r.product_code
        name = r.product_name

        if sku not in db_products:
            discrepancies.append({
                "store_code": st,
                "product_code": sku,
                "type": "UNKNOWN_PRODUCT_CODE",
                "message": f"Məhsul kodu ({sku}) SQL Server bazasında tapılmadı.",
                "proposed_resolution": "Məhsul kodunun ERP-də qeydiyyatda olduğunu yoxlayın."
            })
            continue

        if st not in db_stores:
            discrepancies.append({
                "store_code": st,
                "product_code": sku,
                "type": "UNKNOWN_STORE_CODE",
                "message": f"Mağaza kodu ({st}) SQL Server bazasında tapılmadı.",
                "proposed_resolution": "Mağaza nömrəsini dəqiqləşdirin."
            })
            continue

        actual_name = db_products.get(sku, "")
        if actual_name and name and actual_name.lower() != name.lower():
            discrepancies.append({
                "store_code": st,
                "product_code": sku,
                "type": "PRODUCT_NAME_MISMATCH",
                "message": f"Məhsul adı fərqlidir. Excel: '{name}' | Baza: '{actual_name}'",
                "proposed_resolution": "Rəsmi baza adı qəbul edilir."
            })
            # Update to official database name
            r.product_name = actual_name

        validated_rows.append(r)

    return validated_rows, discrepancies
