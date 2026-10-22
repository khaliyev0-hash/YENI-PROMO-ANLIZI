from datetime import datetime, date
from typing import Dict, Any, List, Optional
from app.distribution.optimizer import calculate_campaign_end_date, calculate_net_order, OrderCalculationItem
from app.distribution.stock_dedup import process_and_deduplicate_stock_rows
from app.distribution.sql_engine import (
    query_stock_details_for_skus,
    query_sales_history_and_forecast,
    query_yoy_sales_history
)
from app.distribution.history_store import save_planning_run

def run_distribution_planning(
    title: str,
    valid_excel_rows: List[Any],
    start_date_str: str,
    duration_days: int,
    target_ending_stock: float = 0.0,
    include_incoming_stock: bool = False,
    history_days: int = 30,
    stockout_correction: bool = False,
    promo_uplift_pct: float = 0.0,
    include_yoy_history: bool = True,
    yoy_weight: float = 0.30,
    yoy_years_back: int = 1
) -> Dict[str, Any]:
    """
    Full end-to-end distribution planning workflow with Safe Baseline forecasting:
    1. Calculate EndDate = StartDate + DurationDays - 1.
    2. Extract distinct SKUs and Stores from Excel rows.
    3. Query live stock details from SQL Server.
    4. Deduplicate stock and apply Supplier Blockage rules.
    5. Query sales history from SQL Server using Safe 30-calendar-day baseline (ADS30).
       (Stockout correction deactivated: no historical daily stock snapshot in DB).
    6. Query YoY sales history from fnc_TS_SALES_REPORT_FOR_PLANNING_UNION.
    7. Compute Blended Base Demand, check double-promo risks, assign explainable confidence.
    8. Compute NetRequirement and pack rounding for every Store x SKU.
    9. Generate Store_Summary and SKU_Summary aggregations.
    10. Compile all Exceptions.
    11. Persist the run and return the complete result.
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

    # 3. Fetch sales history: Safe baseline ADS30 across full calendar days
    # Stockout correction is explicitly False because SQL Server lacks daily stock snapshots
    stockout_hist_avail = False
    stockout_corr_applied = False

    forecast_map, network_averages = query_sales_history_and_forecast(
        product_codes=skus,
        store_codes=stores,
        campaign_start=start_dt,
        duration_days=duration_days,
        history_days=history_days,
        stockout_correction=False,
        promo_uplift_pct=0.0,
        stockout_history_available=False
    )

    # 3b. Fetch past year (YoY) sales history from fnc_TS_SALES_REPORT_FOR_PLANNING_UNION
    yoy_sales_map: Dict[Tuple[str, str], float] = {}
    yoy_promo_map: Dict[Tuple[str, str], float] = {}
    disqualified_yoy_stores: Dict[str, Dict[str, Any]] = {}
    if include_yoy_history:
        yoy_sales_res = query_yoy_sales_history(
            product_codes=skus,
            store_codes=stores,
            campaign_start=start_dt,
            duration_days=duration_days,
            yoy_years_back=yoy_years_back
        )
        yoy_sales_map = yoy_sales_res[0]
        yoy_promo_map = yoy_sales_res[1]
        disqualified_yoy_stores = getattr(yoy_sales_res, "disqualified_stores", {}) or getattr(yoy_sales_map, "disqualified_stores", {})

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

    confidence_counts = {"NORMAL": 0, "LIMITED": 0, "MANUAL_REVIEW": 0}
    method_counts: Dict[str, int] = {}

    w_yoy = max(0.0, min(1.0, float(yoy_weight))) if include_yoy_history else 0.0

    for r in valid_excel_rows:
        st = r.store_code
        sku = r.product_code
        p_name = r.product_name
        shelf_cap = r.shelf_capacity

        stock_info = stock_map.get((st, sku))
        raw_forecast = forecast_map.get((st, sku), 0.0)
        yoy_sales = yoy_sales_map.get((st, sku), 0.0)
        yoy_promo = yoy_promo_map.get((st, sku), 0.0)
        
        disqual_info = disqualified_yoy_stores.get(st)
        is_yoy_disqualified = bool(include_yoy_history and disqual_info is not None)
        yoy_avail = bool(include_yoy_history and yoy_sales > 0 and not is_yoy_disqualified)

        # ---------------------------------------------------------
        # Decision Tree for Forecast Method and Confidence (Rules 6-10)
        # ---------------------------------------------------------
        if raw_forecast > 0 and yoy_avail:
            # Case 1: Both recent 30d trend and YoY history are valid
            recent_fc = raw_forecast
            base_demand = ((1.0 - w_yoy) * recent_fc) + (w_yoy * yoy_sales)
            fc_method = "BLENDED_TREND_YOY"
            fc_confidence = "NORMAL"
            row_warning = "OK"
            warn_reason = None
        elif raw_forecast > 0 and not yoy_avail:
            # Case 2: Only recent 30d trend is available (or store YoY was disqualified)
            recent_fc = raw_forecast
            base_demand = recent_fc
            fc_method = "CURRENT_TREND_ONLY"
            fc_confidence = "NORMAL"
            if is_yoy_disqualified:
                row_warning = "YOY_INSUFFICIENT_STORE_HISTORY"
                warn_reason = disqual_info.get("reason")
            else:
                row_warning = "OK"
                warn_reason = None
        elif raw_forecast <= 0 and yoy_avail:
            # Case 3 (Rule 8): Current sales 0, YoY positive -> YoY Fallback policy
            recent_fc = 0.0
            base_demand = yoy_sales
            fc_method = "YOY_FALLBACK"
            fc_confidence = "LIMITED"
            row_warning = "ZERO_CURRENT_SALES_YOY_FALLBACK"
            warn_reason = f"Son 30 gündə cari satış 0 olub (səbəb məlum deyil: stoksuzluq və ya tələbatın olmaması). Keçən ilin analoji dövr satışı ({yoy_sales:.1f}) fallback kimi tətbiq edildi. Əllə yoxlama tövsiyə olunur."
        else:
            # Case 4 (Rule 9): Both current and YoY are 0 -> Network Average or Shelf Fill
            recent_fc = 0.0
            net_avg_fc = network_averages.get(sku, 0.0)
            if net_avg_fc > 0:
                base_demand = net_avg_fc
                fc_method = "NETWORK_AVERAGE_FALLBACK"
                fc_confidence = "LIMITED"
                row_warning = "FALLBACK_NETWORK_AVG"
                warn_reason = f"Mağazada həm cari, həm də keçən il satışı 0-dır. Şəbəkənin digər mağazalarının orta tələbatı ({net_avg_fc:.1f}) tətbiq edildi. Əllə yoxlama tövsiyə olunur."
            else:
                base_demand = 0.0
                curr_stk_check = stock_info.current_stock if stock_info else 0.0
                if curr_stk_check <= 0 and shelf_cap > 0:
                    fc_method = "INITIAL_SHELF_FILL"
                    fc_confidence = "MANUAL_REVIEW"
                    row_warning = "INITIAL_SHELF_FILL"
                    warn_reason = "Tarixi satış məlumatı yoxdur. Rəf təqdimatı üçün ilkin doldurma tətbiq edildi."
                else:
                    fc_method = "NO_DATA_ZERO"
                    fc_confidence = "MANUAL_REVIEW"
                    row_warning = "NO_DATA"
                    warn_reason = "Tarixi satış məlumatı yoxdur. Proqnoz 0 təyin edildi."

        # ---------------------------------------------------------
        # Rule 10: Promo Uplift & Double-counting Prevention
        # ---------------------------------------------------------
        if fc_method == "YOY_FALLBACK" and yoy_promo > 0:
            # Historical YoY already had promo! Do not re-apply promo uplift
            uplift_mult = 1.0
            uplift_source = "HISTORICAL_PROMO_EMBEDDED"
            warn_reason = (warn_reason or "") + f" Keçən ilin dövrü artıq aksiya olub (Aksiya satışı: {yoy_promo:.1f}). Təkrar promo artımının qarşısı alındı."
        elif yoy_promo > 0 and promo_uplift_pct > 0:
            uplift_mult = 1.0 + (max(0.0, float(promo_uplift_pct)) / 100.0)
            uplift_source = "USER_PARAM_WITH_HISTORICAL_PROMO_FLAG"
            if row_warning == "OK":
                row_warning = "DOUBLE_PROMO_RISK"
            warn_reason = (warn_reason or "") + f" Diqqət: Keçən il eyni dövrdə aksiya satışı olub ({yoy_promo:.1f} ədəd). Təkrar promo effekti riskini nəzərə alın."
        elif promo_uplift_pct > 0:
            uplift_mult = 1.0 + (max(0.0, float(promo_uplift_pct)) / 100.0)
            uplift_source = "USER_PARAMETER"
        else:
            uplift_mult = 1.0
            uplift_source = "NONE"

        forecast_demand = round(base_demand * uplift_mult, 2)

        if not stock_info:
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
            existing_warn = row_warning
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
                existing_warn = row_warning

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
            existing_warning=existing_warn,
            recent_trend_demand=recent_fc,
            yoy_historical_sales=yoy_sales if (yoy_sales > 0 and not is_yoy_disqualified) else None,
            yoy_promo_sales=yoy_promo if (yoy_promo > 0 and not is_yoy_disqualified) else None,
            forecast_method=fc_method,
            forecast_confidence=fc_confidence,
            stockout_correction_applied=stockout_corr_applied,
            stockout_history_available=stockout_hist_avail,
            yoy_data_available=yoy_avail,
            promo_uplift_source=uplift_source,
            warning_reason=warn_reason
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

        confidence_counts[calc_item.forecast_confidence] = confidence_counts.get(calc_item.forecast_confidence, 0) + 1
        method_counts[calc_item.forecast_method] = method_counts.get(calc_item.forecast_method, 0) + 1

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
        "stockout_correction": False,
        "stockout_correction_applied": False,
        "stockout_history_available": False,
        "include_yoy_history": include_yoy_history,
        "yoy_weight": yoy_weight,
        "yoy_years_back": yoy_years_back,
        "store_count": len(store_summary),
        "product_count": len(sku_summary),
        "total_forecast_demand": round(total_forecast, 2),
        "total_current_stock": round(total_current_stock, 2),
        "total_net_requirement": round(total_net_req, 2),
        "total_recommended_order_units": round(total_recommended_units, 2),
        "total_recommended_cases": total_recommended_cases,
        "total_excess_units": round(total_excess_units, 2),
        "warning_count": warning_count,
        "confidence_summary": confidence_counts,
        "method_summary": method_counts,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    parameters = {
        "Kampaniya Başlanğıc Tarixi": start_date_str,
        "Kampaniya Bitiş Tarixi": end_date_str,
        "Promo Müddəti (Gün)": duration_days,
        "Tarixçə Dövrü (Gün)": history_days,
        "Hədəf Bitiş Stoku": target_ending_stock,
        "Promo Uplift Artım Faizi": f"+{promo_uplift_pct:g}%" if promo_uplift_pct > 0 else "0% (Yoxdur)",
        "Stok-out Düzəlişi": "Deaktiv (Tarixi günlük stok olmadığı üçün təhlükəsiz proqnoz: bütün 30 təqvim gününə bölünür)",
        "Stok Tarixçəsi Mövcudluğu": "Yoxdur (SQL Server yalnız cari anbar qalığını saxlayır)",
        "Keçən İlin Eyni Dövrü (YoY Mövsümilik)": f"Aktiv ({int(yoy_weight*100)}% çəki, {yoy_years_back} il əvvəlki eyni həftə, fnc_TS_SALES_REPORT_FOR_PLANNING_UNION)" if include_yoy_history else "Deaktiv",
        "Yoldakı Sifarişlərin Nəzərə Alınması": "Xeyr (Hesablamadan çıxarılıb)",
        "Təchizatçı Blokajı Qaydası": "Yalnız IS YERI TEDARUK TIPI = 41 və TEDARIKCI BLOKAJI = 'beli' istisna edilir",
        "Qablaşdırma Yuvarlaqlaşdırması": "Yalnız təsdiqlənmiş QUTU ICI > 1 olduqda yuxarı yuvarlaqlaşdırılır",
        "Sıfır Cari Satış Fallback Siyasəti": "YoY satışı varsa 'YOY_FALLBACK' (LIMITED dərəcəsi), əks halda şəbəkə ortalaması (LIMITED dərəcəsi)"
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
