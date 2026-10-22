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
    stockout_correction: bool = True,
    promo_uplift_pct: float = 0.0
) -> Tuple[Dict[Tuple[str, str], float], Dict[str, float]]:
    """
    Queries historical sales from fnc_TS_SALES_REPORT_FOR_PLANNING for the given SKUs and stores.
    History range: [campaign_start - history_days, campaign_start - 1 day].
    
    Demand forecasting calculation:
    - Net daily sales = SUM(MIQDARI) (returns negative, retail sales positive; no double counting).
    - Stockout adjustment: if stockout_correction=True, calculates sales velocity based on
      active selling days (COUNT(DISTINCT TARIX)) instead of raw history_days.
    - Promo Uplift: scales projected demand by (1 + promo_uplift_pct / 100).
    - Forecast Demand = Daily Velocity * duration_days * (1 + Uplift).
    - Network Average Fallback: computes average forecast across selling stores for stores with 0 sales.
    
    Returns:
        (sales_map: Dict[(store, sku), forecast], network_averages: Dict[sku, avg_forecast])
    """
    if not product_codes or not store_codes:
        return {}, {}

    clean_skus = list(set(str(c).strip() for c in product_codes if c and str(c).strip()))
    clean_stores = set(str(s).strip() for s in store_codes if s and str(s).strip())

    hist_end = campaign_start - timedelta(days=1)
    hist_start = hist_end - timedelta(days=history_days - 1)

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
                
                # Daily baseline sales velocity (with stockout correction if active)
                if stockout_correction and active_days > 0:
                    effective_days = max(1, min(active_days, history_days))
                    ads = max(0.0, tot_qty) / float(effective_days)
                else:
                    ads = max(0.0, tot_qty) / float(history_days)

                # Apply Promo Uplift percentage
                uplift_mult = 1.0 + (max(0.0, float(promo_uplift_pct)) / 100.0)
                projected_demand = ads * float(duration_days) * uplift_mult
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
