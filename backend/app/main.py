import io
import os
import re
from datetime import datetime, timedelta
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response, Request, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List, Tuple
import json

from app.schemas import AppSettings, ColumnMapping, DataQualityReport, AnalyticsResponse, ForecastAccuracyMetrics
from app.config import DEFAULT_SETTINGS
from app.parser import detect_columns, analyze_data_quality, extract_and_validate_campaign_dates, detect_service_level_columns
from app.normalizer import normalize_excel_data, merge_excel_with_db, parse_service_level_excel
from app.analytics.kpi_calculator import calculate_kpis, compute_fact_records
from app.analytics.time_series import calculate_time_series_metrics, get_item_stock_movement, calculate_daily_sales_series
from app.analytics.forecast_accuracy import calculate_forecast_accuracy
from app.analytics.stockout_analysis import analyze_stockouts_and_lost_sales
from app.analytics.health_scores import calculate_promo_health_score, calculate_store_health_score, calculate_product_health_score
from app.analytics.segmentation import perform_abc_analysis, perform_xyz_analysis, generate_pareto_data, analyze_forecast_bias
from app.analytics.matrix import build_product_store_matrix, build_opportunity_risk_matrix
from app.analytics.group_analysis import aggregate_by_group, get_group_detail
from app.analytics.promo_uplift import compute_promo_uplift
from app.analytics.alerts_recommendations import generate_alerts_and_recommendations
from app.analytics.text_insights import generate_automatic_text_insights
from app.export.excel_exporter import generate_multi_sheet_excel
from app.export.pdf_exporter import generate_pdf_report
from app.demo_data import generate_demo_excel
from contextlib import asynccontextmanager
from app.db import fetch_promo_sales_and_stock, normalize_store_code, normalize_item_code, get_store_historical_stocks, fetch_regular_sales_30d
from app.analytics.inflows import compute_inflows, compute_sales_adjusted_inflows, compute_over_stock, compute_over_stock_base, compute_over_stock_breakdown
from app.services.source_service import process_excel_file
from app.watcher import watcher
from app.distribution.api import router as distribution_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    watcher.start()
    yield
    watcher.stop()

app = FastAPI(title="TAMSTORE PROMO INTELLIGENCE API", version="1.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|10\.14\.(140|141)\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(distribution_router)

def make_cors_response(status_code: int, content: Dict[str, Any], request: Request) -> JSONResponse:
    origin = request.headers.get("origin") or "*"
    response = JSONResponse(status_code=status_code, content=content)
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return make_cors_response(exc.status_code, {"detail": exc.detail}, request)

@app.exception_handler(Exception)
async def custom_unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"Unhandled Exception on {request.url.path}: {str(exc)}\n{traceback.format_exc()}")
    return make_cors_response(500, {"detail": f"Server xətası baş verdi: {str(exc)}"}, request)

# In-memory storage for active dataset session
session_state: Dict[str, Any] = {
    "raw_df": None,
    "fact_df": None,
    "timeline_df": None,
    "mapping": None,
    "quality_report": None,
    "analytics_result": None,
    "settings": DEFAULT_SETTINGS
}

# Directory & File paths for Campaign Archive System
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CAMPAIGNS_DIR = os.path.join(DATA_DIR, "campaigns")
ACTIVE_CAMPAIGN_FILE = os.path.join(DATA_DIR, "active_campaign.json")

os.makedirs(CAMPAIGNS_DIR, exist_ok=True)

def sanitize_campaign_name(name: str) -> str:
    cleaned = re.sub(r'\s+', '_', name.strip())
    ascii_cleaned = cleaned.translate(str.maketrans({
        'Ə':'E', 'ə':'e', 'I':'I', 'ı':'i', 'İ':'I', 'Ö':'O', 'ö':'o',
        'Ü':'U', 'ü':'u', 'Ş':'S', 'ş':'s', 'Ç':'C', 'ç':'c', 'Ğ':'G', 'ğ':'g'
    }))
    safe = re.sub(r'[^a-zA-Z0-9_\-]', '', ascii_cleaned)
    return safe if safe else "campaign"

def get_active_campaign_id() -> Optional[str]:
    if os.path.exists(ACTIVE_CAMPAIGN_FILE):
        try:
            with open(ACTIVE_CAMPAIGN_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("active_campaign_id")
        except Exception:
            return None
    return None

def set_active_campaign_id(campaign_id: str):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(ACTIVE_CAMPAIGN_FILE, "w", encoding="utf-8") as f:
        json.dump({"active_campaign_id": campaign_id}, f, ensure_ascii=False, indent=2)

def save_campaign_archive(insert_name: str, beg_date: str, end_date: str, archive_data: Dict[str, Any]) -> str:
    safe_name = sanitize_campaign_name(insert_name)
    campaign_id = f"{safe_name}_{beg_date}_{end_date}"
    archive_data["id"] = campaign_id
    archive_data["insert_name"] = insert_name
    archive_data["beg_date"] = beg_date
    archive_data["end_date"] = end_date
    archive_data["created_at"] = datetime.now().isoformat()
    
    filepath = os.path.join(CAMPAIGNS_DIR, f"{campaign_id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(archive_data, f, ensure_ascii=False, default=str)
        
    set_active_campaign_id(campaign_id)
    return campaign_id


def load_campaign_archive(campaign_id: str) -> Optional[Dict[str, Any]]:
    filepath = os.path.join(CAMPAIGNS_DIR, f"{campaign_id}.json")
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading campaign archive {campaign_id}: {e}")
            return None
    return None

def list_campaign_metadata() -> List[Dict[str, Any]]:
    if not os.path.exists(CAMPAIGNS_DIR):
        return []
        
    active_id = get_active_campaign_id()
    campaigns = []
    
    for filename in os.listdir(CAMPAIGNS_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(CAMPAIGNS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    c = json.load(f)
                    campaigns.append({
                        "id": c.get("id", filename.replace(".json", "")),
                        "insert_name": c.get("insert_name", "İnsert"),
                        "beg_date": c.get("beg_date", ""),
                        "end_date": c.get("end_date", ""),
                        "created_at": c.get("created_at", ""),
                        "item_count": c.get("item_count", 0),
                        "is_active": False,
                        "is_latest": False
                    })
            except Exception as e:
                print(f"Error reading campaign metadata {filename}: {e}")
                
    campaigns.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    if campaigns:
        campaigns[0]["is_latest"] = True
        active_found = False
        if active_id:
            for c in campaigns:
                if c["id"] == active_id:
                    c["is_active"] = True
                    active_found = True
                    break
        if not active_found:
            campaigns[0]["is_active"] = True
            
    return campaigns

def ensure_complete_analytics_payload(analytics: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(analytics, dict):
        analytics = {}
        
    array_keys = [
        "store_performances", "product_performances", "category_performances",
        "service_level_records", "daily_summaries", "alerts", "recommendations", "stock_dates", "insights",
        "categories", "areas", "families", "sub_areas"
    ]
    for key in array_keys:
        if key not in analytics or analytics[key] is None:
            analytics[key] = []
            
    if "kpi_cards" not in analytics or not isinstance(analytics["kpi_cards"], dict):
        analytics["kpi_cards"] = {
            "total_stores": 0, "total_products": 0, "total_forecast": 0.0,
            "total_sales": 0.0, "total_stock": 0.0, "stockout_stores_count": 0,
            "stockout_products_count": 0, "stockout_rate_pct": 0.0,
            "under_forecast_stores_count": 0, "over_forecast_stores_count": 0,
            "achievement_pct": 0.0, "sell_through_pct": 0.0,
            "wape_pct": 0.0, "mae": 0.0, "rmse": 0.0, "bias": 0.0,
            "promo_health_score": 100, "promo_health_status": "EXCELLENT"
        }
        
    dict_keys = ["accuracy_metrics", "abc_summary", "pareto_data", "bias_summary"]
    for key in dict_keys:
        if key not in analytics or analytics[key] is None:
            analytics[key] = {}
            
    if "daily_sales" not in analytics:
        analytics["daily_sales"] = None

    return analytics

def restore_campaign_session(campaign_data: Dict[str, Any]):
    fact_records = campaign_data.get("fact_records", [])
    timeline_records = campaign_data.get("timeline_records", [])
    analytics = campaign_data.get("analytics")
    if isinstance(analytics, dict) and "daily_sales" in campaign_data:
        if "daily_sales" not in analytics or analytics["daily_sales"] is None:
            analytics["daily_sales"] = campaign_data["daily_sales"]
    
    fact_df = pd.DataFrame(fact_records) if fact_records else None
    if fact_df is not None and not fact_df.empty:
        fact_df.columns = [str(c).upper() for c in fact_df.columns]

    timeline_df = pd.DataFrame(timeline_records) if timeline_records else None
    if timeline_df is not None and not timeline_df.empty:
        timeline_df.columns = [str(c).upper() for c in timeline_df.columns]
    
    mapping_dict = campaign_data.get("mapping")
    mapping = ColumnMapping(**mapping_dict) if mapping_dict else None
    
    quality_dict = campaign_data.get("quality_report")
    quality_report = DataQualityReport(**quality_dict) if quality_dict else None
    
    analytics = campaign_data.get("analytics")
    if analytics:
        analytics = ensure_complete_analytics_payload(analytics)
        campaign_data["analytics"] = analytics

    session_state["fact_df"] = fact_df
    session_state["timeline_df"] = timeline_df
    session_state["raw_df"] = fact_df
    session_state["mapping"] = mapping
    session_state["quality_report"] = quality_report
    session_state["beg_date"] = campaign_data.get("beg_date", "2026-09-03")
    session_state["end_date"] = campaign_data.get("end_date", "2026-09-07")
    session_state["analytics_result"] = analytics



@app.get("/")
def root():
    return {"status": "ok", "app": "TAMSTORE PROMO INTELLIGENCE", "message": "Backend API Server active."}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "TAMSTORE PROMO INTELLIGENCE"}

@app.post("/api/admin/refresh-parquet-cache")
async def refresh_parquet_cache():
    try:
        from scripts.export_to_parquet import export_all_to_parquet
        result = await run_in_threadpool(export_all_to_parquet)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parquet keşi yenilənərkən xəta baş verdi: {str(e)}")

@app.get("/api/admin/cache-status")
def get_parquet_cache_status():
    from scripts.export_to_parquet import META_JSON, STOCK_PARQUET, SALES_PARQUET
    if os.path.exists(META_JSON):
        try:
            with open(META_JSON, "r", encoding="utf-8") as f:
                meta = json.load(f)
                return meta
        except Exception:
            pass
    if os.path.exists(STOCK_PARQUET) and os.path.exists(SALES_PARQUET):
        mtime = datetime.fromtimestamp(os.path.getmtime(SALES_PARQUET)).isoformat()
        return {
            "export_timestamp": mtime,
            "status": "SUCCESS",
            "stock_size_kb": round(os.path.getsize(STOCK_PARQUET) / 1024.0, 2),
            "sales_size_kb": round(os.path.getsize(SALES_PARQUET) / 1024.0, 2)
        }
    return {
        "status": "MISSING",
        "message": "Keş datası tapılmadı, əvvəlcə export_to_parquet.py skriptini işə salın"
    }


@app.get("/api/source/status")
def get_source_status():
    return watcher.get_status()

@app.post("/api/source/refresh")
def refresh_source(force: bool = True):
    started = watcher.trigger_refresh(force=force)
    if started:
        return Response(status_code=202, content=json.dumps({"status": "accepted", "message": "Source refresh initiated"}))
    else:
        raise HTTPException(status_code=409, detail="Source process is already running")

@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Zəhmət olmasa yalnız .xlsx və ya .xls faylı yükləyin.")
    
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Yüklənmiş Excel faylı boşdur.")

    import tempfile, shutil
    temp_dir = tempfile.mkdtemp(prefix="upload_proc_")
    temp_path = os.path.join(temp_dir, file.filename)
    try:
        with open(temp_path, "wb") as f:
            f.write(contents)
        
        result = await run_in_threadpool(
            process_excel_file,
            file_path=temp_path,
            trigger="manual",
            original_filename=file.filename
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=423, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fayl emal edilərkən xəta baş verdi: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.get("/api/campaigns")
def get_campaigns():
    return list_campaign_metadata()

@app.delete("/api/campaigns/clear-all")
@app.post("/api/campaigns/clear-all")
def clear_all_campaigns():
    if os.path.exists(CAMPAIGNS_DIR):
        for f in os.listdir(CAMPAIGNS_DIR):
            if f.endswith(".json"):
                try:
                    os.remove(os.path.join(CAMPAIGNS_DIR, f))
                except Exception as e:
                    print(f"Error removing campaign file {f}: {e}")
    if os.path.exists(ACTIVE_CAMPAIGN_FILE):
        try:
            os.remove(ACTIVE_CAMPAIGN_FILE)
        except Exception:
            pass
    session_state["raw_df"] = None
    session_state["fact_df"] = None
    session_state["timeline_df"] = None
    session_state["analytics_result"] = None
    return {"status": "ok", "message": "Bütün köhnə kampaniya arxivləri təmizləndi."}

@app.get("/api/campaigns/{campaign_id}")
def get_campaign(campaign_id: str):
    data = load_campaign_archive(campaign_id)
    if not data:
        raise HTTPException(status_code=404, detail="Kampaniya tapılmadı.")
    return data

@app.post("/api/campaigns/{campaign_id}/activate")
def activate_campaign(campaign_id: str):
    data = load_campaign_archive(campaign_id)
    if not data:
        raise HTTPException(status_code=404, detail="Kampaniya tapılmadı.")
    set_active_campaign_id(campaign_id)
    restore_campaign_session(data)
    return {"status": "ok", "active_campaign_id": campaign_id, "campaign": data}

def is_valid_campaign_data(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    analytics = data.get("analytics")
    if not isinstance(analytics, dict):
        return False
    kpi_cards = analytics.get("kpi_cards")
    if not isinstance(kpi_cards, dict):
        return False
    return True

@app.get("/api/current-analysis")
def get_current_analysis():
    active_id = get_active_campaign_id()
    if active_id:
        data = load_campaign_archive(active_id)
        if data and is_valid_campaign_data(data):
            restore_campaign_session(data)
            return data
            
    campaigns = list_campaign_metadata()
    for c in campaigns:
        cid = c["id"]
        data = load_campaign_archive(cid)
        if data and is_valid_campaign_data(data):
            set_active_campaign_id(cid)
            restore_campaign_session(data)
            return data
            
    if session_state.get("analytics_result") and isinstance(session_state["analytics_result"], dict) and session_state["analytics_result"].get("kpi_cards"):
        return {
            "analytics": session_state["analytics_result"],
            "mapping": session_state.get("mapping").model_dump() if session_state.get("mapping") else None,
            "quality_report": session_state.get("quality_report").model_dump() if session_state.get("quality_report") else None,
            "confidence": 1.0,
            "beg_date": session_state.get("beg_date", "2026-09-03"),
            "end_date": session_state.get("end_date", "2026-09-07")
        }
        
    return {"analytics": None}



@app.post("/api/upload/service-level")
async def upload_service_level_excel(file: UploadFile = File(...)):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Zəhmət olmasa yalnız .xlsx və ya .xls faylı yükləyin.")
    
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel faylı oxunarkən xəta baş verdi: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Yüklənmiş Service Level Excel faylı boşdur.")

    sl_mapping, confidence = detect_service_level_columns(df.columns.tolist())
    sl_records = parse_service_level_excel(df, sl_mapping)

    session_state["service_level_records"] = sl_records
    if session_state.get("analytics_result"):
        session_state["analytics_result"]["service_level_records"] = sl_records

    return {
        "mapping": sl_mapping.model_dump(),
        "confidence": confidence,
        "total_records": len(sl_records),
        "service_level_records": sl_records,
        "sample_rows": df.head(10).fillna("").to_dict(orient="records")
    }

@app.post("/api/analyze")
def run_analysis(payload: Dict[str, Any]):
    import time
    t_start = time.perf_counter()

    mapping_data = payload.get("mapping")
    settings_data = payload.get("settings", {})
    
    settings = AppSettings(**settings_data) if settings_data else DEFAULT_SETTINGS
    session_state["settings"] = settings

    if mapping_data:
        mapping = ColumnMapping(**mapping_data)
    else:
        mapping = session_state.get("mapping")

    excel_df = session_state.get("excel_df")
    db_df = session_state.get("db_df")

    t0 = time.perf_counter()
    if excel_df is not None:
        if mapping is not None:
            merged_df = merge_excel_with_db(excel_df, mapping, db_df)
            session_state["raw_df"] = merged_df
            df = merged_df
        else:
            df = session_state.get("raw_df")
    else:
        df = session_state.get("raw_df")
    print(f"[TIMING analyze] Merge with DB: {time.perf_counter()-t0:.4f}s")

    if df is None or df.empty:
        raise HTTPException(
            status_code=400, 
            detail="Məlumat tapılmadı (Sessiya sıfırlanıb və ya Excel yüklənməyib). Zəhmət olmasa əvvəlcə Excel faylını yükləyin."
        )

    if mapping is None:
        raise HTTPException(
            status_code=400,
            detail="Sütun xəritələnməsi tapılmadı. Zəhmət olmasa Excel faylını yenidən yükləyin."
        )

    try:
        # Normalize into PROMO_FACT and STOCK_TIMELINE
        t0 = time.perf_counter()
        fact_df, timeline_df = normalize_excel_data(
            df, mapping, 
            db_df=session_state.get("db_df"), 
            beg_date=session_state.get("beg_date"), 
            end_date=session_state.get("end_date")
        )
        session_state["fact_df"] = fact_df
        session_state["timeline_df"] = timeline_df
        print(f"[TIMING analyze] Normalize excel data: {time.perf_counter()-t0:.4f}s")

        # Calculate Analytics
        t0 = time.perf_counter()
        analytics_payload = process_analytics(
            fact_df, timeline_df, settings,
            db_df=session_state.get("db_df"),
            beg_date=session_state.get("beg_date"),
            end_date=session_state.get("end_date")
        )
        session_state["analytics_result"] = analytics_payload
        print(f"[TIMING analyze] Process analytics: {time.perf_counter()-t0:.4f}s")
        print(f"[TIMING analyze] TOTAL run_analysis: {time.perf_counter()-t_start:.4f}s")
        return analytics_payload
    except HTTPException:
        raise
    except Exception as err:
        print(f"[ERROR analyze] Təhlil zamanı xəta baş verdi: {err}")
        raise HTTPException(status_code=400, detail=f"Təhlil emalında xəta baş verdi: {str(err)}")

@app.get("/api/demo-data")
def load_demo_data(format_type: str = "B"):
    excel_bytes = generate_demo_excel(format_type)
    df = pd.read_excel(io.BytesIO(excel_bytes))
    
    mapping, confidence = detect_columns(df.columns.tolist())
    quality_report = analyze_data_quality(df, mapping)
    fact_df, timeline_df = normalize_excel_data(df, mapping)
    
    settings = session_state.get("settings", DEFAULT_SETTINGS)
    
    session_state["raw_df"] = df
    session_state["mapping"] = mapping
    session_state["quality_report"] = quality_report
    session_state["fact_df"] = fact_df
    session_state["timeline_df"] = timeline_df

    analytics_payload = process_analytics(fact_df, timeline_df, settings)
    session_state["analytics_result"] = analytics_payload
    
    return {
        "mapping": mapping.model_dump(),
        "confidence": confidence,
        "quality_report": quality_report.model_dump(),
        "analytics": analytics_payload
    }

@app.get("/api/db/fetch")
def load_db_data(beg_date: str = "2026-09-03", end_date: str = "2026-09-07"):
    try:
        raw_db_df = fetch_promo_sales_and_stock(beg_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verilənlər bazasından məlumat oxunarkən xəta baş verdi: {str(e)}")

    if raw_db_df.empty:
        raise HTTPException(status_code=404, detail="Qeyd olunan tarix aralığında satış məlumatı tapılmadı.")

    # Aggregate DB rows into PROMO_FACT format
    fact_df = raw_db_df.groupby(['store_code', 'item_code'], as_index=False).agg({
        'item_name': 'first',
        'family_name': 'first',
        'sales_qty': 'sum',
        'sales_amount': 'sum',
        'current_stock': 'last'
    }).rename(columns={
        'store_code': 'STORE',
        'item_code': 'CODE',
        'item_name': 'NAME',
        'family_name': 'FAMILY',
        'sales_qty': 'SALE',
        'current_stock': 'FINAL_STOCK'
    })
    
    fact_df['FC'] = (fact_df['SALE'] * 1.15).round(2)
    fact_df['DISTRIBUTION_QTY'] = fact_df['SALE'] + fact_df['FINAL_STOCK']
    fact_df['FAMILY'] = fact_df['FAMILY'].fillna("Baqaliyya & Ərzaq")

    # Build STOCK_TIMELINE
    timeline_records = []
    for _, row in raw_db_df.iterrows():
        s_date = str(row['sale_date'])[:10]
        timeline_records.append({
            "STORE": str(row['store_code']),
            "CODE": str(row['item_code']),
            "STOCK_DATE": s_date,
            "STOCK_QTY": float(row['current_stock'])
        })
    timeline_df = pd.DataFrame(timeline_records)

    settings = session_state.get("settings", DEFAULT_SETTINGS)
    
    session_state["raw_df"] = raw_db_df
    session_state["fact_df"] = fact_df
    session_state["timeline_df"] = timeline_df

    analytics_payload = process_analytics(
        fact_df, timeline_df, settings,
        db_df=raw_db_df,
        beg_date=beg_date,
        end_date=end_date
    )
    session_state["analytics_result"] = analytics_payload

    return {
        "beg_date": beg_date,
        "end_date": end_date,
        "total_records": len(raw_db_df),
        "unique_items": len(fact_df),
        "analytics": analytics_payload
    }

@app.get("/api/item-detail")
def get_item_detail(store: str, code: str):
    timeline_df = session_state.get("timeline_df")
    fact_df = session_state.get("fact_df")
    
    if fact_df is None or timeline_df is None:
        raise HTTPException(status_code=400, detail="Aktiv təhlil sessiyası yoxdur.")

    norm_st = normalize_store_code(store) or store
    norm_cd = normalize_item_code(code) or code

    if store.upper() == "ALL" or not store:
        item_fact = fact_df[(fact_df['CODE'] == code) | (fact_df['CODE'] == norm_cd)]
    else:
        item_fact = fact_df[
            ((fact_df['STORE'] == store) | (fact_df['STORE'] == norm_st)) &
            ((fact_df['CODE'] == code) | (fact_df['CODE'] == norm_cd))
        ]
    if item_fact.empty:
        raise HTTPException(status_code=404, detail="Məhsul tapılmadı.")
        
    actual_store = str(item_fact.iloc[0]['STORE'])
    movement = get_item_stock_movement(timeline_df, actual_store, code)
    row = item_fact.iloc[0]
    
    return {
        "store": str(row['STORE']),
        "code": str(row['CODE']),
        "name": str(row['NAME']),
        "fc": float(row['FC']),
        "sale": float(row['SALE']),
        "final_stock": float(row['FINAL_STOCK']),
        "movement": movement
    }

@app.get("/api/store-daily-stock")
def get_store_daily_stock(store: str):
    fact_df, timeline_df = ensure_active_fact_df()
    if fact_df is None or fact_df.empty:
        raise HTTPException(status_code=400, detail="Aktiv təhlil sessiyası yoxdur.")

    norm_store_target = normalize_store_code(store) or store
    
    # Filter fact_df for target store
    store_mask = fact_df['STORE'].astype(str).apply(lambda s: (normalize_store_code(s) or s) == norm_store_target)
    store_fact = fact_df[store_mask]
    
    if store_fact.empty:
        return {"store": store, "dates": [], "products": []}

    # Determine 24-day window dates: window_start = beg_date - 10 days; window_end = end_date
    active_campaign_id = get_active_campaign_id()
    active_campaign = load_campaign_archive(active_campaign_id) if active_campaign_id else None
    
    beg_date = str(active_campaign.get("beg_date"))[:10] if (active_campaign and active_campaign.get("beg_date")) else None
    end_date = str(active_campaign.get("end_date"))[:10] if (active_campaign and active_campaign.get("end_date")) else None

    if not beg_date and timeline_df is not None and not timeline_df.empty:
        t_dates = [str(d)[:10] for d in timeline_df['STOCK_DATE'].unique() if str(d).strip()]
        if t_dates:
            t_dates.sort()
            beg_date = t_dates[0]
            end_date = t_dates[-1]

    if not beg_date or len(beg_date) < 10:
        beg_date = "2026-10-15"
        end_date = "2026-10-28"

    try:
        b_dt = datetime.strptime(beg_date[:10], "%Y-%m-%d")
        e_dt = datetime.strptime(end_date[:10], "%Y-%m-%d")
        win_start = b_dt - timedelta(days=10)
        window_dates = [(win_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range((e_dt - win_start).days + 1)]
    except Exception as e:
        print(f"Error computing window dates: {e}")
        window_dates = []

    today_str = datetime.now().strftime("%Y-%m-%d")
    latest_data_date = min(today_str, end_date) if end_date else today_str

    # Build stock map from timeline_df or DB
    stock_map: Dict[Tuple[str, str], float] = {}
    
    # 1. First check timeline_df in session
    if timeline_df is not None and not timeline_df.empty:
        t_mask = timeline_df['STORE'].astype(str).apply(lambda s: (normalize_store_code(s) or s) == norm_store_target)
        t_store = timeline_df[t_mask]
        for _, tr in t_store.iterrows():
            cd = normalize_item_code(tr['CODE']) or str(tr['CODE']).strip()
            dt = str(tr['STOCK_DATE'])[:10]
            if pd.notnull(tr['STOCK_QTY']):
                stock_map[(cd, dt)] = float(tr['STOCK_QTY'])

    # 2. Check disk / memory cache for DB snapshots (up to 2026-10-16)
    past_dates_in_db = [d for d in window_dates if d <= '2026-10-16']
    if past_dates_in_db:
        from app.db import _STORE_STOCK_CACHE
        cache_key = (norm_store_target, tuple(sorted(past_dates_in_db)))
        if cache_key in _STORE_STOCK_CACHE:
            stock_map.update(_STORE_STOCK_CACHE[cache_key])
        else:
            for (c_st, c_dts), c_items in _STORE_STOCK_CACHE.items():
                if c_st == norm_store_target and set(past_dates_in_db).issubset(set(c_dts)):
                    stock_map.update({k: v for k, v in c_items.items() if k[1] in past_dates_in_db})
                    break

    # 3. Read store daily sales from parquet cache to enable accurate daily stock reconstruction
    daily_sales_by_item: Dict[Tuple[str, str], float] = {}
    try:
        from app.db import SALES_PARQUET
        if os.path.exists(SALES_PARQUET):
            s_filters = [
                ('store_code', 'in', [norm_store_target, str(store).strip()]),
                ('sale_date', '>=', window_dates[0] if window_dates else '2026-10-01'),
                ('sale_date', '<=', latest_data_date)
            ]
            store_sales_df = pd.read_parquet(SALES_PARQUET, engine='pyarrow', filters=s_filters)
            if not store_sales_df.empty:
                agg = store_sales_df.groupby(['item_code', 'sale_date'])['sales_qty'].sum().reset_index()
                for ic, sd, sq in zip(agg['item_code'], agg['sale_date'], agg['sales_qty']):
                    ic_norm = normalize_item_code(ic) or str(ic).strip()
                    dt = str(sd)[:10]
                    daily_sales_by_item[(ic_norm, dt)] = daily_sales_by_item.get((ic_norm, dt), 0.0) + float(sq)
    except Exception as e:
        print(f"Warning: Could not read daily sales from parquet for store {store}: {e}")

    # Fetch 30-day regular sales for items in store
    all_item_codes = [str(c).strip() for c in store_fact['CODE'].dropna().unique() if str(c).strip()]
    regular_sales_map: Dict[Tuple[str, str], float] = {}
    regular_query_failed = False
    try:
        regular_sales_map = fetch_regular_sales_30d(
            store_codes=[norm_store_target],
            item_codes=all_item_codes,
            end_date=end_date
        )
    except Exception as e:
        print(f"Warning: 30-day regular sales DB query failed: {e}")
        regular_query_failed = True

    products = []
    store_records = store_fact.to_dict(orient='records')
    for row in store_records:
        code = str(row['CODE']).strip()
        norm_code = normalize_item_code(code) or code
        name = str(row['NAME'])
        fc = float(row['FC']) if pd.notnull(row['FC']) else 0.0
        sale = float(row['SALE']) if pd.notnull(row['SALE']) else 0.0
        final_stock = float(row['FINAL_STOCK']) if pd.notnull(row['FINAL_STOCK']) else 0.0
        
        dist_qty = float(row['DISTRIBUTION_QTY']) if ('DISTRIBUTION_QTY' in row and pd.notnull(row['DISTRIBUTION_QTY'])) else (sale + final_stock)

        stocks: List[Optional[float]] = []
        for d in window_dates:
            if d > latest_data_date:
                # Future date beyond available data: null/None
                stocks.append(None)
            else:
                # Check authoritative snapshot in stock_map
                snap_val = stock_map.get((norm_code, d))
                if snap_val is None:
                    snap_val = stock_map.get((code, d))
                
                if snap_val is not None:
                    stocks.append(float(snap_val))
                else:
                    # Reconstruct backwards from final_stock as of latest_data_date using real daily sales
                    later_dates = [x for x in window_dates if d < x <= latest_data_date]
                    sales_after = sum(
                        daily_sales_by_item.get((norm_code, x), daily_sales_by_item.get((code, x), 0.0))
                        for x in later_dates
                    )
                    reconstructed_stock = max(0.0, round(final_stock + sales_after, 2))
                    stocks.append(reconstructed_stock)

        inflows, inflow_total = compute_inflows(stocks)

        ref_val = float(row['REF']) if ('REF' in row and pd.notnull(row['REF']) and row['REF'] is not None) else None
        
        # last_stock definition: stock on campaign end_date, or latest non-null day
        non_null_stocks = [s for s in stocks if s is not None]
        last_stock_val = non_null_stocks[-1] if non_null_stocks else final_stock

        norm_code = normalize_item_code(code) or code
        if regular_query_failed:
            reg_30d_val = None
        else:
            reg_30d_val = regular_sales_map.get((norm_store_target, norm_code), 0.0)

        over_stock_base = compute_over_stock_base(inflow_total, sale, last_stock_val)
        over_stock_val = compute_over_stock(inflow_total, sale, last_stock_val, ref_val, reg_30d_val)
        over_stock_breakdown = compute_over_stock_breakdown(inflow_total, sale, last_stock_val, ref_val, reg_30d_val)

        products.append({
            "code": code,
            "name": name,
            "distribution_qty": dist_qty,
            "inflow_total": inflow_total,
            "fc": fc,
            "sale": sale,
            "final_stock": final_stock,
            "ref": ref_val,
            "regular_30d": reg_30d_val,
            "over_stock": over_stock_val,
            "over_stock_base": over_stock_base,
            "over_stock_breakdown": over_stock_breakdown,
            "dates": window_dates,
            "stocks": stocks,
            "inflows": inflows
        })

    return {
        "store": store,
        "dates": window_dates,
        "products": products
    }

def ensure_active_fact_df() -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame]]:
    fact_df = session_state.get("fact_df")
    timeline_df = session_state.get("timeline_df")
    if fact_df is not None and not fact_df.empty:
        return fact_df, timeline_df
        
    # Attempt to restore active campaign analysis
    get_current_analysis()
    fact_df = session_state.get("fact_df")
    timeline_df = session_state.get("timeline_df")
    if fact_df is not None and not fact_df.empty:
        return fact_df, timeline_df
        
    # Fallback to load demo data B on backend
    try:
        load_demo_data("B")
        return session_state.get("fact_df"), session_state.get("timeline_df")
    except Exception as e:
        print(f"Error auto-loading demo data in ensure_active_fact_df: {e}")
        return None, None

@app.get("/api/matrix")
def get_matrix(metric: str = "achievement", date: Optional[str] = None):
    fact_df, timeline_df = ensure_active_fact_df()
    if fact_df is None or fact_df.empty:
        raise HTTPException(status_code=400, detail="Məlumat yoxdur.")
    matrix = build_product_store_matrix(fact_df, timeline_df, metric, date)
    return matrix.model_dump()

@app.get("/api/risk-matrix")
def get_risk_matrix():
    fact_df, _ = ensure_active_fact_df()
    settings = session_state.get("settings", DEFAULT_SETTINGS)
    if fact_df is None or fact_df.empty:
        raise HTTPException(status_code=400, detail="Məlumat yoxdur.")
    return build_opportunity_risk_matrix(fact_df, settings)

@app.get("/api/group-analysis")
def get_group_analysis_endpoint(
    dimension: str = Query(..., pattern="^(category|area)$"),
    category: Optional[str] = None,
    area: Optional[str] = None,
    sub_area: Optional[str] = None,
    store: Optional[str] = None,
    family: Optional[str] = None,
    product: Optional[str] = None
):
    fact_df, timeline_df = ensure_active_fact_df()
    if fact_df is None or fact_df.empty:
        return {
            "dimension": dimension,
            "groups": [],
            "totals": {
                "stores": 0, "skus": 0, "pairs": 0, "fc": 0.0, "sale": 0.0,
                "achievement_pct": None, "stock": 0.0, "stockout_pairs": 0,
                "stockout_pct": 0.0, "osa_pct": 100.0, "distribution_qty": 0.0,
                "share_of_total_sale_pct": 0.0
            },
            "unassigned": {"pairs": 0, "share_pct": 0.0},
            "filter_options": {"categories": [], "areas": []},
            "daily_timeline": []
        }
    beg_date = session_state.get("beg_date")
    end_date = session_state.get("end_date")
    as_of_date = session_state.get("as_of_date")
    return aggregate_by_group(
        fact_df,
        dimension=dimension,
        category=category,
        area=area,
        sub_area=sub_area,
        store=store,
        family=family,
        product=product,
        beg_date=beg_date,
        end_date=end_date,
        as_of_date=as_of_date,
        timeline_df=timeline_df
    )

@app.get("/api/group-analysis/detail")
def get_group_analysis_detail_endpoint(
    dimension: str = Query(..., pattern="^(category|area)$"),
    path: Optional[List[str]] = Query(None),
    name: Optional[str] = Query(None),
    parent: Optional[str] = Query(None),
    sub: Optional[str] = Query(None),
    category: Optional[str] = None,
    area: Optional[str] = None,
    sub_area: Optional[str] = None,
    store: Optional[str] = None,
    family: Optional[str] = None,
    product: Optional[str] = None
):
    fact_df, _ = ensure_active_fact_df()
    if fact_df is None or fact_df.empty:
        return {"dimension": dimension, "path": path or [], "name": parent or name or "", "items": []}
    return get_group_detail(
        fact_df,
        dimension=dimension,
        path=path,
        name=name,
        parent=parent,
        sub=sub,
        category=category,
        area=area,
        sub_area=sub_area,
        store=store,
        family=family,
        product=product
    )
 
@app.get("/api/promo-uplift")
def get_promo_uplift_endpoint(
    category: Optional[str] = None,
    promo_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    store: Optional[str] = None,
    campaign_id: Optional[str] = None,
    beg_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    if campaign_id:
        active_id = get_active_campaign_id()
        if active_id != campaign_id:
            c_data = load_campaign_archive(campaign_id)
            if c_data and is_valid_campaign_data(c_data):
                restore_campaign_session(c_data)

    fact_df, _ = ensure_active_fact_df()
    b_date = beg_date or session_state.get("beg_date", "2026-10-15")
    e_date = end_date or session_state.get("end_date", "2026-10-28")

    analytics_res = session_state.get("analytics_result") or {}
    daily_sales = analytics_res.get("daily_sales") if isinstance(analytics_res, dict) else None

    return compute_promo_uplift(
        fact_df=fact_df,
        beg_date=b_date,
        end_date=e_date,
        category_filter=category,
        promo_type_filter=promo_type,
        status_filter=status,
        search_query=search,
        store_filter=store,
        daily_sales_records=daily_sales
    )


@app.get("/api/export/excel")
def export_excel():
    ensure_active_fact_df()
    fact_df = session_state.get("fact_df")
    timeline_df = session_state.get("timeline_df")
    analytics_res = session_state.get("analytics_result")
    
    if fact_df is None or analytics_res is None:
        raise HTTPException(status_code=400, detail="İxrac üçün aktiv təhlil yoxdur.")
        
    buffer = generate_multi_sheet_excel(fact_df, timeline_df if timeline_df is not None else pd.DataFrame(), analytics_res)
    return Response(
        content=buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Tamstore_Promo_Intelligence_Report.xlsx"}
    )

@app.get("/api/export/pdf")
def export_pdf():
    analytics_res = session_state.get("analytics_result")
    if analytics_res is None:
        get_current_analysis()
        analytics_res = session_state.get("analytics_result")
    if analytics_res is None:
        raise HTTPException(status_code=400, detail="İxrac üçün aktiv təhlil yoxdur.")
        
    campaign_meta = {
        "beg_date": session_state.get("beg_date", "2026-10-15"),
        "end_date": session_state.get("end_date", "2026-10-28"),
        "campaign_id": session_state.get("active_campaign_name") or session_state.get("active_campaign_id") or "15-28 Promo Campaign"
    }
    buffer = generate_pdf_report(analytics_res, campaign_meta=campaign_meta)
    return Response(
        content=buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Tamstore_Executive_Supply_Chain_Report.pdf"}
    )

def process_analytics(
    fact_df: pd.DataFrame, 
    timeline_df: pd.DataFrame, 
    settings: AppSettings,
    db_df: Optional[pd.DataFrame] = None,
    beg_date: Optional[str] = None,
    end_date: Optional[str] = None,
    as_of_date: Optional[str] = None
) -> Dict[str, Any]:
    """Helper function computing all analytics payloads."""
    # 1. Base KPIs
    kpi_dict = calculate_kpis(fact_df, timeline_df, settings)
    
    # 2. Accuracy Metrics
    accuracy = calculate_forecast_accuracy(fact_df)
    
    # 3. Promo Health Score
    promo_score, promo_status = calculate_promo_health_score(fact_df, settings)
    kpi_dict["promo_health_score"] = promo_score
    kpi_dict["promo_health_status"] = promo_status
    kpi_dict["wape_pct"] = accuracy.wape
    kpi_dict["mae"] = accuracy.mae
    kpi_dict["rmse"] = accuracy.rmse
    kpi_dict["bias"] = accuracy.bias

    # 4. Store Performance Aggregations
    store_rows = []
    if not fact_df.empty:
        df_work = fact_df.copy()
        df_work['stout_flag'] = (df_work['FINAL_STOCK'] <= 0.0001).astype(int)
        df_work['under_fc_val'] = (df_work['FC'] - df_work['SALE']).clip(lower=0.0)
        df_work['over_fc_val'] = (df_work['SALE'] - df_work['FC']).clip(lower=0.0)
        if 'DISTRIBUTION_QTY' not in df_work.columns:
            df_work['DISTRIBUTION_QTY'] = df_work['SALE'] + df_work['FINAL_STOCK']
        if 'FC_MEBLEG' not in df_work.columns:
            df_work['FC_MEBLEG'] = 0.0

        st_agg_kwargs = dict(
            product_count=('CODE', 'count'),
            st_fc=('FC', 'sum'),
            st_fc_azn=('FC_MEBLEG', 'sum'),
            st_sale=('SALE', 'sum'),
            st_stock=('FINAL_STOCK', 'sum'),
            st_dist=('DISTRIBUTION_QTY', 'sum'),
            st_stout=('stout_flag', 'sum'),
            u_fc=('under_fc_val', 'sum'),
            o_fc=('over_fc_val', 'sum')
        )
        if 'AREA' in df_work.columns:
            st_agg_kwargs['st_area'] = ('AREA', 'first')
        if 'SUB_AREA' in df_work.columns:
            st_agg_kwargs['st_sub_area'] = ('SUB_AREA', 'first')

        st_agg = df_work.groupby('STORE', as_index=False).agg(**st_agg_kwargs)

        for r in st_agg.to_dict(orient='records'):
            st_name = str(r['STORE'])
            p_cnt = int(r['product_count'])
            st_fc = float(r['st_fc'])
            st_fc_azn = float(r['st_fc_azn'])
            st_sale = float(r['st_sale'])
            st_stock = float(r['st_stock'])
            st_dist = float(r['st_dist'])
            st_stout = int(r['st_stout'])
            u_fc = float(r['u_fc'])
            o_fc = float(r['o_fc'])

            raw_area = r.get('st_area')
            raw_sub_area = r.get('st_sub_area')
            s_area = str(raw_area) if raw_area is not None and str(raw_area).strip() not in ('nan', 'None', '') else None
            s_sub_area = str(raw_sub_area) if raw_sub_area is not None and str(raw_sub_area).strip() not in ('nan', 'None', '') else None

            st_ach = round((st_sale / st_fc) * 100.0, 1) if st_fc > 0 else None
            st_stout_pct = round((st_stout / p_cnt) * 100.0, 1) if p_cnt > 0 else 0.0
            denom = st_sale + st_stock
            st_sell_th = round((st_sale / denom) * 100.0, 1) if denom > 0 else None

            s_score, s_status = calculate_store_health_score(st_fc, st_sale, st_stock, st_stout_pct, settings)

            store_rows.append({
                "store": st_name,
                "area": s_area,
                "sub_area": s_sub_area,
                "product_count": p_cnt,
                "total_fc": round(st_fc, 1),
                "total_fc_azn": round(st_fc_azn, 1),
                "total_sale": round(st_sale, 1),
                "achievement_pct": st_ach,
                "total_stock": round(st_stock, 1),
                "total_distribution_qty": round(st_dist, 1),
                "stockout_count": st_stout,
                "stockout_pct": st_stout_pct,
                "sell_through_pct": st_sell_th,
                "under_forecast": round(u_fc, 1),
                "over_forecast": round(o_fc, 1),
                "health_score": s_score,
                "health_status": s_status,
                "rank": 0
            })

    store_rows.sort(key=lambda x: x['total_sale'], reverse=True)
    for idx, s in enumerate(store_rows, start=1):
        s['rank'] = idx

    # 5. Segmentations: ABC, XYZ, Lost Sales
    abc_res = perform_abc_analysis(fact_df, settings)
    xyz_dict, has_xyz = perform_xyz_analysis(timeline_df)
    stockout_res = analyze_stockouts_and_lost_sales(fact_df, timeline_df, settings)
    lost_sales_dict = stockout_res["estimated_lost_sales_by_product"]

    # 6. Product Performance Aggregations
    prod_rows = []
    if not fact_df.empty:
        df_prod = fact_df.copy()
        df_prod['stout_flag'] = (df_prod['FINAL_STOCK'] <= 0.0001).astype(int)
        df_prod['u_flag'] = (df_prod['FC'] > df_prod['SALE']).astype(int)
        df_prod['o_flag'] = (df_prod['SALE'] > df_prod['FC']).astype(int)
        if 'DISTRIBUTION_QTY' not in df_prod.columns:
            df_prod['DISTRIBUTION_QTY'] = df_prod['SALE'] + df_prod['FINAL_STOCK']
        if 'FC_MEBLEG' not in df_prod.columns:
            df_prod['FC_MEBLEG'] = 0.0

        agg_kwargs = dict(
            store_count=('STORE', 'count'),
            p_fc=('FC', 'sum'),
            p_fc_azn=('FC_MEBLEG', 'sum'),
            p_sale=('SALE', 'sum'),
            p_stock=('FINAL_STOCK', 'sum'),
            p_dist=('DISTRIBUTION_QTY', 'sum'),
            stout_cnt=('stout_flag', 'sum'),
            u_cnt=('u_flag', 'sum'),
            o_cnt=('o_flag', 'sum')
        )
        if 'PROMO_TYPE' in df_prod.columns:
            agg_kwargs['p_promo_type'] = ('PROMO_TYPE', 'first')
        if 'CATEGORY' in df_prod.columns:
            agg_kwargs['p_category'] = ('CATEGORY', 'first')
        if 'SUB_CATEGORY' in df_prod.columns:
            agg_kwargs['p_sub_category'] = ('SUB_CATEGORY', 'first')
        if 'FAMILY' in df_prod.columns:
            agg_kwargs['p_family'] = ('FAMILY', 'first')

        p_agg = df_prod.groupby(['CODE', 'NAME'], as_index=False).agg(**agg_kwargs)

        for r in p_agg.to_dict(orient='records'):
            p_code = str(r['CODE'])
            p_name = str(r['NAME'])
            s_cnt = int(r['store_count'])
            p_fc = float(r['p_fc'])
            p_fc_azn = float(r['p_fc_azn'])
            p_sale = float(r['p_sale'])
            p_stock = float(r['p_stock'])
            p_dist = float(r['p_dist'])
            stout_cnt = int(r['stout_cnt'])
            u_cnt = int(r['u_cnt'])
            o_cnt = int(r['o_cnt'])
            p_promo_type = str(r.get('p_promo_type', 'adi'))

            raw_cat = r.get('p_category')
            raw_subcat = r.get('p_sub_category')
            raw_fam = r.get('p_family')

            p_cat = str(raw_cat) if raw_cat is not None and str(raw_cat).strip() not in ('nan', 'None', '') else None
            p_subcat = str(raw_subcat) if raw_subcat is not None and str(raw_subcat).strip() not in ('nan', 'None', '') else None
            p_fam = str(raw_fam) if raw_fam is not None and str(raw_fam).strip() not in ('nan', 'None', '') else None

            p_ach = round((p_sale / p_fc) * 100.0, 1) if p_fc > 0 else None
            denom = p_sale + p_stock
            p_sell_th = round((p_sale / denom) * 100.0, 1) if denom > 0 else None
            stout_pct = round((stout_cnt / s_cnt) * 100.0, 1) if s_cnt > 0 else 0.0

            est_lost = lost_sales_dict.get(p_code, 0.0)
            p_abc = abc_res["items"].get(p_code, "C")
            p_xyz = xyz_dict.get(p_code, "N/A") if has_xyz else "N/A"

            p_score, p_status = calculate_product_health_score(p_fc, p_sale, p_stock, stout_pct, settings)

            prod_rows.append({
                "code": p_code,
                "name": p_name,
                "category": p_cat,
                "sub_category": p_subcat,
                "family": p_fam,
                "store_count": s_cnt,
                "total_fc": round(p_fc, 1),
                "total_fc_azn": round(p_fc_azn, 1),
                "total_sale": round(p_sale, 1),
                "achievement_pct": p_ach,
                "total_stock": round(p_stock, 1),
                "total_distribution_qty": round(p_dist, 1),
                "sell_through_pct": p_sell_th,
                "stockout_store_count": stout_cnt,
                "stockout_pct": stout_pct,
                "under_forecast_stores": u_cnt,
                "over_forecast_stores": o_cnt,
                "estimated_lost_sales": round(est_lost, 1),
                "estimated_lost_revenue": round(est_lost * (p_fc_azn / p_fc), 2) if p_fc > 0 and p_fc_azn > 0 else 0.0,
                "promo_type": p_promo_type,
                "abc_class": p_abc,
                "xyz_class": p_xyz,
                "health_score": p_score,
                "health_status": p_status,
                "recommendation": "MAINTAIN"
            })

    # 7. Category Aggregations for Sales & Trends
    cat_rows = []
    if 'FAMILY' in fact_df.columns:
        for cat_name, cat_group in fact_df.groupby('FAMILY'):
            c_fc = float(cat_group['FC'].sum())
            c_fc_azn = float(cat_group['FC_MEBLEG'].sum()) if 'FC_MEBLEG' in cat_group.columns else 0.0
            c_sale = float(cat_group['SALE'].sum())
            c_ach = round((c_sale / c_fc) * 100.0, 1) if c_fc > 0 else 0.0
            cat_rows.append({
                "family": str(cat_name),
                "total_fc": round(c_fc, 1),
                "total_fc_azn": round(c_fc_azn, 1),
                "total_sale": round(c_sale, 1),
                "achievement_pct": c_ach
            })
    cat_rows.sort(key=lambda x: x['total_fc'], reverse=True)

    # 8. Service Level Records
    supplier_map = {
        "101201": "Azərsun Qida MMC", "101202": "Agro-Trade MMC", "101203": "Anchor Azerbaijan",
        "101204": "Pal Süt Qrup", "101205": "Milli Şəkər MMC", "101206": "Dənər Un Sanayi",
        "101207": "Azərçay ASC", "101208": "Milli Süd MMC", "101209": "Nestle Azerbaijan",
        "101210": "Mondelez Azerbaijan", "101211": "Coca-Cola Bottlers", "101212": "Sirab ASC",
        "101213": "Xırdalan Şirniyyat", "101214": "Ankara Qida", "101215": "Basmati Impex",
        "101216": "Milli Yumurta MMC", "101217": "Heinz Azerbaijan", "101218": "Milli Süd Qrup",
        "101219": "Unilever Ice Cream", "101220": "Selpak Hygiene", "101221": "Procter & Gamble",
        "101222": "Unilever Personal Care", "101223": "Colgate-Palmolive", "101224": "Olive Impex",
        "101225": "Olive Impex", "101226": "Ivanhoe Dairy", "101227": "Halal Et Qida",
        "101228": "Dəniz Et Qida", "101229": "Milli Toyuq MMC", "101230": "Fish Conserves Impex"
    }
    if session_state.get("service_level_records"):
        sl_rows = session_state["service_level_records"]
    elif 'SERVICE_LEVEL' in fact_df.columns:
        sl_rows = []
        sl_sub = fact_df.dropna(subset=['SERVICE_LEVEL'])
        for row in sl_sub.head(500).to_dict(orient='records'):
            st = str(row.get('STORE', ''))
            cd = str(row.get('CODE', ''))
            nm = str(row.get('NAME', ''))
            fc = float(row.get('FC', 0.0)) if pd.notnull(row.get('FC')) else 0.0
            
            dist_val = row.get('DISTRIBUTION_QTY')
            ordered = float(dist_val) if dist_val is not None and pd.notnull(dist_val) and float(dist_val) > 0 else (float(fc) if fc > 0 else 0.0)
            
            sup_val = row.get('SUPPLIER')
            sup = str(sup_val).strip() if sup_val is not None and pd.notnull(sup_val) and str(sup_val).strip() not in ['', 'None', 'nan'] else supplier_map.get(cd, f"Təchizatçı {cd[:3]}")

            try:
                sl_raw = float(row['SERVICE_LEVEL'])
                sl_pct = round(sl_raw * 100.0, 1) if sl_raw <= 1.0 else round(sl_raw, 1)
                sl_pct = min(sl_pct, 100.0)
            except (ValueError, TypeError):
                continue

            accepted = round(ordered * (sl_pct / 100.0))
            if sl_pct >= 95.0:
                sl_status = "EXCELLENT"
            elif sl_pct >= 90.0:
                sl_status = "GOOD"
            elif sl_pct >= 75.0:
                sl_status = "WEAK"
            else:
                sl_status = "CRITICAL"
                
            sl_rows.append({
                "store": st,
                "supplier": sup,
                "code": cd,
                "name": nm,
                "ordered_qty": ordered,
                "accepted_qty": accepted,
                "service_level_pct": sl_pct,
                "status": sl_status
            })
    else:
        sl_rows = []

    # 9. Time-series Daily Summaries
    daily_summaries, ts_meta = calculate_time_series_metrics(timeline_df)

    # 9.1 Real Daily Sales Series (Genuine per-day sales breakdown)
    daily_sales = calculate_daily_sales_series(
        db_df=db_df,
        fact_df=fact_df,
        beg_date=beg_date,
        end_date=end_date,
        total_fc=kpi_dict.get("total_forecast", 0.0),
        total_fc_azn=kpi_dict.get("total_forecast_azn", 0.0),
        as_of_date=as_of_date
    )

    # 10. Alerts & Recommendations
    alerts, recommendations = generate_alerts_and_recommendations(fact_df, settings)

    # 11. Dynamic Text Insights (Bilingual AZ / EN)
    insights = generate_automatic_text_insights(fact_df, accuracy, settings, lang="az")
    english_insights = generate_automatic_text_insights(fact_df, accuracy, settings, lang="en")

    # 12. Pareto & Bias
    pareto_data = generate_pareto_data(fact_df)
    bias_summary = analyze_forecast_bias(fact_df)

    return ensure_complete_analytics_payload({
        "kpi_cards": kpi_dict,
        "accuracy_metrics": accuracy.model_dump(),
        "insights": insights,
        "english_insights": english_insights,
        "store_performances": store_rows,
        "product_performances": prod_rows,
        "category_performances": cat_rows,
        "service_level_records": sl_rows,
        "daily_summaries": [d.model_dump() for d in daily_summaries],
        "daily_sales": daily_sales,
        "alerts": [a.model_dump() for a in alerts],
        "recommendations": [r.model_dump() for r in recommendations],
        "abc_summary": abc_res["classes"],
        "pareto_data": pareto_data,
        "bias_summary": bias_summary,
        "has_daily_time_series": ts_meta.get("has_time_series", False),
        "stock_dates": ts_meta.get("dates", []),
        "categories": sorted(list(set(fact_df['CATEGORY'].dropna().astype(str).str.strip()))) if 'CATEGORY' in fact_df.columns else [],
        "areas": sorted(list(set(fact_df['AREA'].dropna().astype(str).str.strip()))) if 'AREA' in fact_df.columns else [],
        "families": sorted(list(set(fact_df['FAMILY'].dropna().astype(str).str.strip()))) if 'FAMILY' in fact_df.columns else [],
        "sub_areas": sorted(list(set(fact_df['SUB_AREA'].dropna().astype(str).str.strip()))) if 'SUB_AREA' in fact_df.columns else []
    })

