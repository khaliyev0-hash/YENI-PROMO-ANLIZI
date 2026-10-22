from datetime import datetime, date
from typing import Dict, Any, List, Optional
from app.distribution.optimizer import calculate_campaign_end_date, calculate_net_order, OrderCalculationItem
from app.distribution.stock_dedup import process_and_deduplicate_stock_rows
from app.distribution.sql_engine import query_stock_details_for_skus, query_sales_history_and_forecast
from app.distribution.history_store import save_planning_run

def run_distribution_planning(
    title: str,
    valid_excel_rows: List[Any],
    start_date_str: str,
    duration_days: int,
    target_ending_stock: float = 0.0,
    include_incoming_stock: bool = False,
    history_days: int = 30,
    stockout_correction: bool = True,
    promo_uplift_pct: float = 0.0
) -> Dict[str, Any]:
    """
    Full end-to-end distribution planning workflow:
    1. Calculate EndDate = StartDate + DurationDays - 1.
    2. Extract distinct SKUs and Stores from Excel rows.
    3. Query live stock details from SQL Server.
    4. Deduplicate stock and apply Supplier Blockage rules.
    5. Query sales history from SQL Server and calculate forecast demand.
    6. Compute NetRequirement and pack rounding for every Store × SKU.
    7. Generate Store_Summary and SKU_Summary aggregations.
    8. Compile all Exceptions.
    9. Persist the run and return the complete result.
    """
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_dt = calculate_campaign_end_date(start_dt, duration_days)
    end_date_str = end_dt.strftime("%Y-%m-%d")

    skus = list(set(r.product_code for r in valid_excel_rows))
    stores = list(set(r.store_code for r in valid_excel_rows))

    # 1. Fetch raw stock from SQL Server
    raw_stock_rows = query_stock_details_for_skus(skus, stores)

    # 2. Deduplicate stock and apply supplier blockage
    stock_map, stock_exceptions = process_and_deduplicate_stock_rows(raw_stock_rows)

    # 3. Fetch sales history and forecast demand (including network averages for zero-sales fallback)
    forecast_map, network_averages = query_sales_history_and_forecast(
        product_codes=skus,
        store_codes=stores,
        campaign_start=start_dt,
        duration_days=duration_days,
        history_days=history_days,
        stockout_correction=stockout_correction,
        promo_uplift_pct=promo_uplift_pct
    )

    # 4. Compute orders per (Store, SKU) in Excel
    calculated_orders: List[Dict[str, Any]] = []
    all_exceptions: List[Dict[str, Any]] = [e.model_dump() for e in stock_exceptions]

    total_forecast = 0.0
    total_current_stock = 0.0
    total_net_req = 0.0
    total_recommended_units = 0.0
    total_recommended_cases = 0
    total_excess_units = 0.0
    warning_count = 0

    for r in valid_excel_rows:
        st = r.store_code
        sku = r.product_code
        p_name = r.product_name
        shelf_cap = r.shelf_capacity

        stock_info = stock_map.get((st, sku))
        raw_forecast = forecast_map.get((st, sku), 0.0)

        # Fallback logic: If store has 0 historical sales (e.g. was out of stock)
        is_fallback_forecast = False
        if raw_forecast > 0:
            forecast_demand = raw_forecast
        else:
            net_avg_fc = network_averages.get(sku, 0.0)
            if net_avg_fc > 0:
                forecast_demand = net_avg_fc
                is_fallback_forecast = True
            else:
                forecast_demand = 0.0

        if not stock_info:
            # Stock record missing from database for this store-sku
            all_exceptions.append({
                "store_code": st,
                "product_code": sku,
                "product_name": p_name,
                "exception_type": "MISSING_STOCK_RECORD",
                "description": f"Mağazada ({st}) bu məhsul ({sku}) üçün stok qeydiyyatı tapılmadı (0 qəbul edilir).",
                "source": "vw_TS_ITEMS_DETAIL_MAGAZA_FOR_PLANNING",
                "affected_calculations": "Cari stok 0 qəbul edildi.",
                "proposed_resolution": "Mağaza çeşid matrisini yoxlayın."
            })
            curr_stock = 0.0
            usable_stock = 0.0
            incoming_stk = 0.0
            cq = 1.0
            bq = 1.0
            unit = "ADET"
            barcode = None
            sup_code = None
            sup_name = None
            is_blocked = False
            existing_warn = "FALLBACK_NETWORK_AVG" if is_fallback_forecast else "LOW_DATA_HISTORY"
        else:
            curr_stock = stock_info.current_stock
            usable_stock = stock_info.usable_current_stock
            incoming_stk = 0.0  # Incoming orders excluded per business requirement
            cq = stock_info.case_quantity
            bq = stock_info.block_quantity
            unit = stock_info.unit
            barcode = stock_info.barcode
            sup_code = stock_info.supplier_code
            sup_name = stock_info.supplier_name
            is_blocked = stock_info.is_blocked
            existing_warn = stock_info.warning_status
            if existing_warn == "OK":
                if is_fallback_forecast:
                    existing_warn = "FALLBACK_NETWORK_AVG"
                elif forecast_demand == 0 and curr_stock == 0:
                    existing_warn = "INITIAL_SHELF_FILL"

        calc_item = calculate_net_order(
            store_code=st,
            product_code=sku,
            product_name=p_name,
            start_date=start_date_str,
            end_date=end_date_str,
            duration_days=duration_days,
            forecast_demand=forecast_demand,
            current_stock=curr_stock,
            usable_current_stock=usable_stock,
            shelf_capacity=shelf_cap,
            case_quantity=cq,
            block_quantity=bq,
            eligible_incoming_stock=incoming_stk,
            target_ending_stock=target_ending_stock,
            unit=unit,
            barcode=barcode,
            supplier_code=sup_code,
            supplier_name=sup_name,
            is_blocked=is_blocked,
            existing_warning=existing_warn
        )

        calc_dict = calc_item.model_dump()
        calculated_orders.append(calc_dict)

        total_forecast += calc_item.forecast_demand
        total_current_stock += calc_item.current_stock
        total_net_req += calc_item.net_requirement
        total_recommended_units += calc_item.recommended_order_units
        total_recommended_cases += calc_item.recommended_cases
        total_excess_units += calc_item.excess_units_from_rounding

        if calc_item.warning_status != "OK":
            warning_count += 1

    # 5. Generate Store_Summary
    store_groups: Dict[str, List[Dict[str, Any]]] = {}
    for o in calculated_orders:
        store_groups.setdefault(o["store_code"], []).append(o)

    store_summary = []
    for st_code, items in store_groups.items():
        st_name = items[0].get("store_name") or f"Mağaza {st_code}"
        store_summary.append({
            "store_code": st_code,
            "store_name": st_name,
            "product_count": len(items),
            "total_forecast_demand": round(sum(i["forecast_demand"] for i in items), 2),
            "total_current_stock": round(sum(i["current_stock"] for i in items), 2),
            "total_recommended_order": round(sum(i["recommended_order_units"] for i in items), 2),
            "warning_count": sum(1 for i in items if i["warning_status"] != "OK")
        })
    store_summary.sort(key=lambda x: x["total_recommended_order"], reverse=True)

    # 6. Generate SKU_Summary
    sku_groups: Dict[str, List[Dict[str, Any]]] = {}
    for o in calculated_orders:
        sku_groups.setdefault(o["product_code"], []).append(o)

    sku_summary = []
    for p_code, items in sku_groups.items():
        p_name = items[0].get("product_name") or p_code
        sku_summary.append({
            "product_code": p_code,
            "product_name": p_name,
            "store_count": len(items),
            "total_forecast_demand": round(sum(i["forecast_demand"] for i in items), 2),
            "total_current_stock": round(sum(i["current_stock"] for i in items), 2),
            "total_recommended_order": round(sum(i["recommended_order_units"] for i in items), 2),
            "warning_count": sum(1 for i in items if i["warning_status"] != "OK")
        })
    sku_summary.sort(key=lambda x: x["total_recommended_order"], reverse=True)

    # 7. Overall Summary
    summary = {
        "title": title,
        "start_date": start_date_str,
        "end_date": end_date_str,
        "duration_days": duration_days,
        "history_days": history_days,
        "promo_uplift_pct": promo_uplift_pct,
        "stockout_correction": stockout_correction,
        "store_count": len(store_summary),
        "product_count": len(sku_summary),
        "total_forecast_demand": round(total_forecast, 2),
        "total_current_stock": round(total_current_stock, 2),
        "total_net_requirement": round(total_net_req, 2),
        "total_recommended_order_units": round(total_recommended_units, 2),
        "total_recommended_cases": total_recommended_cases,
        "total_excess_units": round(total_excess_units, 2),
        "warning_count": warning_count,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    parameters = {
        "Kampaniya Başlanğıc Tarixi": start_date_str,
        "Kampaniya Bitiş Tarixi": end_date_str,
        "Promo Müddəti (Gün)": duration_days,
        "Tarixçə Dövrü (Gün)": history_days,
        "Hədəf Bitiş Stoku": target_ending_stock,
        "Promo Uplift Artım Faizi": f"+{promo_uplift_pct:g}%" if promo_uplift_pct > 0 else "0% (Yoxdur)",
        "Stok-out Düzəlişi (Aktiv Satış Günləri)": "Aktiv (Yalnız stok olan günlərin sürəti)" if stockout_correction else "Deaktiv (Bütün 30 günə bölünür)",
        "Yoldakı Sifarişlərin Nəzərə Alınması": "Xeyr (Hesablamadan çıxarılıb)",
        "Təchizatçı Blokajı Qaydası": "Yalnız IS YERI TEDARUK TIPI = 41 və TEDARIKCI BLOKAJI = 'beli' istisna edilir",
        "Qablaşdırma Yuvarlaqlaşdırması": "QUTU ICI (və ya BLOK ICI) üzrə yuxarı yuvarlaqlaşdırma",
        "Sıfır Satış/Stok Fallback Metodu": "Şəbəkənin aktiv mağazalarının orta gündəlik satışı (Network Average)",
        "Sıfır Stok Rəf Təminatı": "Stok 0 olan mağazalar üçün minimum 1 qutu və ya rəf tutumu qədər ilkin təminat"
    }

    # 8. Save planning run
    run_id = save_planning_run(
        title=title,
        start_date=start_date_str,
        end_date=end_date_str,
        duration_days=duration_days,
        summary=summary,
        parameters=parameters,
        orders=calculated_orders,
        store_summary=store_summary,
        sku_summary=sku_summary,
        exceptions=all_exceptions
    )

    return {
        "run_id": run_id,
        "summary": summary,
        "parameters": parameters,
        "orders": calculated_orders,
        "store_summary": store_summary,
        "sku_summary": sku_summary,
        "exceptions": all_exceptions
    }
