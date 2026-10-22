import os
import hashlib
import shutil
import tempfile
import time
import pandas as pd
from typing import Optional, Dict, Any, Tuple

from app.config import EXCEL_SOURCE_PATH, DEFAULT_SETTINGS
from app.parser import detect_columns, analyze_data_quality, extract_and_validate_campaign_dates
from app.normalizer import normalize_excel_data, merge_excel_with_db
from app.analytics.kpi_calculator import calculate_kpis
from app.db import fetch_promo_sales_and_stock, get_active_store_codes, normalize_store_code
from app.schemas import ColumnMapping, DataQualityWarning

def get_project_root() -> str:
    # app/services/source_service.py -> app/services -> app -> backend -> project_root
    service_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(service_dir)
    backend_dir = os.path.dirname(app_dir)
    project_root = os.path.dirname(backend_dir)
    return project_root

def resolve_source_path(config_path: Optional[str] = None) -> Tuple[Optional[str], bool]:
    """
    Resolves the source Excel file path based on EXCEL_SOURCE_PATH.
    Returns (resolved_abs_path_or_none, is_configured).
    """
    path_setting = config_path if config_path is not None else EXCEL_SOURCE_PATH
    if not path_setting:
        return None, False

    project_root = get_project_root()
    if not os.path.isabs(path_setting):
        target_path = os.path.abspath(os.path.join(project_root, path_setting))
    else:
        target_path = os.path.abspath(path_setting)

    if os.path.isdir(target_path):
        candidates = []
        try:
            for fname in os.listdir(target_path):
                if fname.startswith("~$") or fname.startswith("."):
                    continue
                if fname.lower().endswith(".xlsx") or fname.lower().endswith(".xls"):
                    full_p = os.path.join(target_path, fname)
                    if os.path.isfile(full_p):
                        candidates.append((os.path.getmtime(full_p), full_p))
        except Exception:
            pass

        if not candidates:
            return target_path, True  # Configured path is a directory but no xlsx found inside
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1], True

    if os.path.exists(target_path):
        # Ignore temp excel files starting with ~$ or .
        fname = os.path.basename(target_path)
        if fname.startswith("~$") or fname.startswith("."):
            return None, True
        return target_path, True

    return target_path, True

def compute_file_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def process_excel_file(
    file_path: str,
    trigger: str = "auto",
    original_filename: Optional[str] = None,
    progress_callback = None
) -> Dict[str, Any]:
    """
    Single unified processing pipeline for Excel input files.
    Used by both /api/upload (manual) and background source_watcher (auto).
    """
    t_start = time.perf_counter()
    
    if progress_callback:
        progress_callback("Fayl oxunur...")

    # Copy to a temp file before reading to prevent lock issues
    temp_dir = tempfile.mkdtemp(prefix="excel_proc_")
    temp_copy_path = os.path.join(temp_dir, f"copy_{os.path.basename(file_path)}")
    try:
        shutil.copy2(file_path, temp_copy_path)
    except PermissionError as pe:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise PermissionError(f"Fayl Excel tərəfindən kilidlənib: {str(pe)}")
    except Exception as copy_err:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise copy_err

    try:
        t0 = time.perf_counter()
        try:
            df = pd.read_excel(temp_copy_path)
        except Exception as e:
            raise ValueError(f"Excel faylı oxunarkən xəta baş verdi: {str(e)}")
        print(f"[TIMING] Excel parse: {time.perf_counter()-t0:.4f}s (rows: {len(df)})")

        if df.empty:
            raise ValueError("Yüklənmiş Excel faylı boşdur.")

        if progress_callback:
            progress_callback("Sütunlar və tarixlər yoxlanılır...")

        t0 = time.perf_counter()
        mapping, confidence = detect_columns(df.columns.tolist())
        print(f"[TIMING] Column mapping: {time.perf_counter()-t0:.4f}s (code_col: {mapping.code_col}, store_col: {mapping.store_col})")

        # Validate required columns for auto processing
        missing_req = []
        if not mapping.code_col:
            missing_req.append("Məhsul Kodu (code)")
        if not mapping.store_col:
            missing_req.append("Mağaza Kodu (store)")
        if not (mapping.fc_col or mapping.fc_mebleg_col):
            missing_req.append("Proqnoz Miqdarı / Məbləği (fc)")
        if not mapping.start_date_col:
            missing_req.append("Başlama Tarixi (start_date)")
        if not mapping.end_date_col:
            missing_req.append("Bitmə Tarixi (end_date)")

        if missing_req:
            hdr_str = ", ".join([str(c) for c in df.columns.tolist()[:15]])
            raise ValueError(f"Tələb olunan sütunlar tapılmadı: {', '.join(missing_req)}. Tapılan sütunlar: {hdr_str}")

        t0 = time.perf_counter()
        beg_date, end_date = extract_and_validate_campaign_dates(df, mapping)
        print(f"[TIMING] Date validation: {time.perf_counter()-t0:.4f}s ({beg_date} to {end_date})")

        # TASK 2: Filter stores early before DB queries
        if progress_callback:
            progress_callback("Aktiv mağazalar yoxlanılır...")

        t0 = time.perf_counter()
        active_store_codes, store_breakdown = get_active_store_codes()

        all_view_stores = (
            set(store_breakdown["kept"])
            | set(store_breakdown["dropped_status"])
            | set(store_breakdown["dropped_type"])
            | set(store_breakdown.get("dropped_conflicting", []))
        )

        store_col = mapping.store_col
        df_norm_stores = df[store_col].apply(normalize_store_code)
        excel_stores_all = set(df_norm_stores.dropna().unique())

        unmatched_stores = sorted(list(excel_stores_all - all_view_stores))
        mask_active = df_norm_stores.isin(active_store_codes)

        excluded_df = df[~mask_active]
        df_filtered = df[mask_active].copy()

        dropped_rows = len(excluded_df)
        dropped_stores_set = set(df_norm_stores[~mask_active].dropna().unique())

        dropped_by_status = sorted(list(dropped_stores_set & set(store_breakdown["dropped_status"])))
        dropped_by_type = sorted(list(dropped_stores_set & set(store_breakdown["dropped_type"])))
        dropped_conflicting = sorted(list(dropped_stores_set & set(store_breakdown.get("dropped_conflicting", []))))
        dropped_unmatched = sorted(list(dropped_stores_set & set(unmatched_stores)))

        dropped_fc = 0.0
        if mapping.fc_col and mapping.fc_col in excluded_df.columns:
            dropped_fc = float(pd.to_numeric(excluded_df[mapping.fc_col], errors='coerce').fillna(0.0).sum())

        dropped_distribution_qty = 0.0
        if mapping.distribution_col and mapping.distribution_col in excluded_df.columns:
            dropped_distribution_qty = float(pd.to_numeric(excluded_df[mapping.distribution_col], errors='coerce').fillna(0.0).sum())

        print(
            f"[TIMING] Store Filter: {time.perf_counter()-t0:.4f}s "
            f"(Excel rows: {len(df)} -> {len(df_filtered)}, stores: {len(excel_stores_all)} -> {len(excel_stores_all & active_store_codes)}, "
            f"dropped rows: {dropped_rows}, dropped stores: {len(dropped_stores_set)})"
        )

        if df_filtered.empty:
            raise ValueError("Mağaza filtrindən sonra heç bir sətr qalmadı. Bütün mağazalar qeyri-aktivdir və ya istisna edilib.")

        df = df_filtered

        if progress_callback:
            progress_callback("DB-dən satış və stok datası çəkilir...")

        t0 = time.perf_counter()
        item_codes = df[mapping.code_col].astype(str).str.strip().unique().tolist() if mapping.code_col else None
        store_codes = df[mapping.store_col].astype(str).str.strip().unique().tolist() if mapping.store_col else None

        db_warning = None
        try:
            db_df = fetch_promo_sales_and_stock(beg_date, end_date, item_codes, store_codes)
        except Exception as db_err:
            print(f"[DEBUG] DB Baglanti Xetasi: {db_err}")
            db_warning = f"Canlı DB datasına qoşulmaq mümkün olmadı (Offline rejim): {str(db_err)}"
            db_df = pd.DataFrame(columns=['store_code', 'item_code', 'sales_qty', 'current_stock', 'supplier_name'])
        print(f"[TIMING] DB Query (fetch_promo_sales_and_stock): {time.perf_counter()-t0:.4f}s (returned rows: {len(db_df)})")

        if progress_callback:
            progress_callback("Datalar birləşdirilir...")

        t0 = time.perf_counter()
        merged_df = merge_excel_with_db(df, mapping, db_df)
        print(f"[TIMING] Merge logic: {time.perf_counter()-t0:.4f}s")

        t0 = time.perf_counter()
        quality_report = analyze_data_quality(merged_df, mapping)

        # Add Store Filter warnings
        if dropped_rows > 0:
            reasons = []
            if dropped_by_type:
                reasons.append(f"İstisna tip ({len(dropped_by_type)} mağaza: {', '.join(dropped_by_type[:10])}{'...' if len(dropped_by_type) > 10 else ''})")
            if dropped_by_status:
                reasons.append(f"Qeyri-aktiv status ({len(dropped_by_status)} mağaza: {', '.join(dropped_by_status[:10])}{'...' if len(dropped_by_status) > 10 else ''})")
            if dropped_conflicting:
                reasons.append(f"Ziddiyyətli qeydlər ({len(dropped_conflicting)} mağaza: {', '.join(dropped_conflicting)})")
            if dropped_unmatched:
                reasons.append(f"Cədvəldə tapılmayan ({len(dropped_unmatched)} mağaza: {', '.join(dropped_unmatched)})")

            warning_desc = (
                f"{dropped_rows:,} rows ({len(dropped_stores_set)} stores) excluded: not AKTIV / TIP BLANK|MINI|REGION MINI. "
                f"Dropped FC: {dropped_fc:,.1f}, Dropped Distribution: {dropped_distribution_qty:,.1f}. "
                f"Səbəblər: {'; '.join(reasons)}"
            )
            quality_report.warnings.append(DataQualityWarning(
                type="STORE_FILTER",
                severity="MEDIUM",
                description=warning_desc,
                count=dropped_rows,
                affected_rows=[]
            ))

        if unmatched_stores:
            quality_report.warnings.append(DataQualityWarning(
                type="STORE_UNMATCHED",
                severity="HIGH",
                description=f"{len(unmatched_stores)} mağaza kodu vw_TS_MARKET_DETAILS cədvəlində tapılmadı və ya formatı uyğun gəlmir: {', '.join(unmatched_stores[:20])}",
                count=len(unmatched_stores),
                affected_rows=[]
            ))

        print(f"[TIMING] Data Quality report: {time.perf_counter()-t0:.4f}s")

        if progress_callback:
            progress_callback("Analitika hesablanır...")

        t0 = time.perf_counter()
        fact_df, timeline_df = normalize_excel_data(merged_df, mapping, db_df=db_df, beg_date=beg_date, end_date=end_date)

        from app.main import process_analytics, save_campaign_archive, session_state
        analytics_payload = process_analytics(
            fact_df, timeline_df, session_state.get("settings", DEFAULT_SETTINGS),
            db_df=db_df, beg_date=beg_date, end_date=end_date
        )
        print(f"[TIMING] Pre-computing analytics for archive: {time.perf_counter()-t0:.4f}s")

        # Derive insert_name
        insert_name = None
        if mapping.insert_name_col and mapping.insert_name_col in df.columns:
            valid_vals = df[mapping.insert_name_col].dropna().astype(str).str.strip()
            valid_vals = valid_vals[valid_vals != ""]
            if not valid_vals.empty:
                insert_name = valid_vals.iloc[0]

        if not insert_name:
            fn = original_filename or os.path.basename(file_path)
            fname = fn.rsplit('.', 1)[0] if '.' in fn else fn
            insert_name = fname.replace("_", " ").title()

        archive_payload = {
            "insert_name": insert_name,
            "beg_date": beg_date,
            "end_date": end_date,
            "item_count": len(fact_df) if fact_df is not None else len(df),
            "mapping": mapping.model_dump(),
            "quality_report": quality_report.model_dump(),
            "confidence": confidence,
            "sample_rows": merged_df.head(10).fillna("").to_dict(orient="records"),
            "df_columns": df.columns.tolist(),
            "analytics": analytics_payload,
            "daily_sales": analytics_payload.get("daily_sales"),
            "fact_records": fact_df.fillna("").to_dict(orient="records") if fact_df is not None else [],
            "timeline_records": (timeline_df.head(5000) if len(timeline_df) > 5000 else timeline_df).fillna("").to_dict(orient="records") if timeline_df is not None else []
        }

        if progress_callback:
            progress_callback("Kampaniya arxivləşdirilir...")

        t0 = time.perf_counter()
        campaign_id = save_campaign_archive(insert_name, beg_date, end_date, archive_payload)
        print(f"[TIMING] Save campaign archive: {time.perf_counter()-t0:.4f}s (Campaign ID: {campaign_id})")

        # Update in-memory session state
        session_state["raw_df"] = merged_df
        session_state["excel_df"] = df
        session_state["db_df"] = db_df
        session_state["mapping"] = mapping
        session_state["quality_report"] = quality_report
        session_state["beg_date"] = beg_date
        session_state["end_date"] = end_date
        session_state["fact_df"] = fact_df
        session_state["timeline_df"] = timeline_df
        session_state["analytics_result"] = analytics_payload
        session_state["service_level_records"] = None

        total_secs = time.perf_counter() - t_start
        print(f"[TIMING] TOTAL process_excel_file ({trigger}): {total_secs:.4f}s")

        res_data = {
            "campaign_id": campaign_id,
            "insert_name": insert_name,
            "mapping": mapping.model_dump(),
            "confidence": confidence,
            "quality_report": quality_report.model_dump(),
            "df_columns": df.columns.tolist(),
            "sample_rows": merged_df.head(10).fillna("").to_dict(orient="records"),
            "beg_date": beg_date,
            "end_date": end_date,
            "analytics": analytics_payload,
            "rows": len(df),
            "seconds": round(total_secs, 2)
        }
        if db_warning:
            res_data["db_warning"] = db_warning
        return res_data

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
