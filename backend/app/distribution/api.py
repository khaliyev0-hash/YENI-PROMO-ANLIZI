import io
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.db import get_db_connection
from app.distribution.excel_processor import (
    parse_and_validate_excel_template,
    generate_rejected_rows_excel,
    generate_distribution_6sheet_excel,
    ImportedRow
)
from app.distribution.sql_engine import cross_validate_with_master_data
from app.distribution.service import run_distribution_planning
from app.distribution.history_store import list_planning_runs, get_planning_run

router = APIRouter(prefix="/api", tags=["Distribution Planning"])

# ----------------------------------------------------
# 1. Health & Source Status
# ----------------------------------------------------
@router.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": "TAMSTORE Promo Distribution Optimization API",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@router.get("/source/status")
def get_source_status():
    server = os.getenv("DB_SERVER", "cltmdb03")
    database = os.getenv("DB_NAME", "Ltamstore")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        return {
            "status": "connected",
            "server": server,
            "database": database,
            "read_only": True,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "server": server,
            "database": database,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# ----------------------------------------------------
# 2. Excel Import Preview & Validation
# ----------------------------------------------------
@router.post("/import/preview")
async def import_preview(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Yalnız Excel (.xlsx, .xls) faylları dəstəklənir.")
    
    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fayl həcmi 25 MB-dan artıq ola bilməz.")

    try:
        val_result = parse_and_validate_excel_template(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel faylını oxumaq mümkün olmadı: {str(e)}")

    return {
        "filename": file.filename,
        "total_rows": val_result.total_rows,
        "valid_count": val_result.valid_count,
        "rejected_count": val_result.rejected_count,
        "duplicate_count": val_result.duplicate_count,
        "distinct_stores": val_result.distinct_stores,
        "distinct_products": val_result.distinct_products,
        "preview_rows": [r.model_dump() for r in val_result.valid_rows[:50]],
        "rejected_rows_sample": [r.model_dump() for r in val_result.rejected_rows[:20]]
    }

@router.post("/import/validate")
async def import_validate_with_db(file: UploadFile = File(...)):
    contents = await file.read()
    val_result = parse_and_validate_excel_template(contents)

    # Cross validate valid rows with database master data
    validated_rows, discrepancies = cross_validate_with_master_data(val_result.valid_rows)

    return {
        "filename": file.filename,
        "excel_valid_count": val_result.valid_count,
        "db_verified_count": len(validated_rows),
        "discrepancies_count": len(discrepancies),
        "discrepancies": discrepancies[:30],
        "preview_rows": [r.model_dump() for r in validated_rows[:50]]
    }

@router.post("/import/download-rejected")
async def download_rejected_rows(file: UploadFile = File(...)):
    contents = await file.read()
    val_result = parse_and_validate_excel_template(contents)
    if not val_result.rejected_rows:
        raise HTTPException(status_code=400, detail="Faylda rədd edilmiş sətr yoxdur.")

    rejected_excel = generate_rejected_rows_excel(val_result.rejected_rows)
    return Response(
        content=rejected_excel,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=rejected_rows.xlsx"}
    )

# ----------------------------------------------------
# 3. Planning Runs
# ----------------------------------------------------
class PlanningRunRequest(BaseModel):
    title: str = "Promo Planlaşdırma Kampaniyası"
    start_date: str  # YYYY-MM-DD
    duration_days: int = 7
    target_ending_stock: float = 0.0
    include_incoming_stock: bool = False
    history_days: int = 30
    stockout_correction: bool = True
    promo_uplift_pct: float = 0.0
    rows: List[ImportedRow]

@router.post("/planning-runs")
def create_planning_run(payload: PlanningRunRequest):
    if not payload.rows:
        raise HTTPException(status_code=400, detail="Planlaşdırma üçün heç bir düzgün sətr təqdim edilməyib.")
    if payload.duration_days < 1:
        raise HTTPException(status_code=400, detail="Promo müddəti ən azı 1 gün olmalıdır.")

    try:
        result = run_distribution_planning(
            title=payload.title,
            valid_excel_rows=payload.rows,
            start_date_str=payload.start_date,
            duration_days=payload.duration_days,
            target_ending_stock=payload.target_ending_stock,
            include_incoming_stock=payload.include_incoming_stock,
            history_days=payload.history_days,
            stockout_correction=payload.stockout_correction,
            promo_uplift_pct=payload.promo_uplift_pct
        )
        return {
            "status": "success",
            "run_id": result["run_id"],
            "summary": result["summary"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Planlaşdırma hesablaması zamanı xəta: {str(e)}")

@router.get("/planning-runs")
def get_all_planning_runs():
    runs = list_planning_runs()
    return {"runs": [r.model_dump() for r in runs]}

@router.get("/planning-runs/{run_id}")
def get_single_planning_run(run_id: str):
    data = get_planning_run(run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Planlaşdırma tapılmadı.")
    return {
        "metadata": data.get("metadata"),
        "summary": data.get("summary"),
        "parameters": data.get("parameters")
    }

@router.get("/planning-runs/{run_id}/results")
def get_planning_run_results(
    run_id: str,
    store: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    warning_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500)
):
    data = get_planning_run(run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Planlaşdırma tapılmadı.")

    orders = data.get("orders", [])

    # Filters
    filtered = orders
    if store:
        filtered = [o for o in filtered if o.get("store_code") == store.strip()]
    if product:
        filtered = [o for o in filtered if o.get("product_code") == product.strip()]
    if warning_status and warning_status.upper() != "ALL":
        filtered = [o for o in filtered if o.get("warning_status") == warning_status.strip()]
    if search:
        s = search.strip().lower()
        filtered = [
            o for o in filtered 
            if s in str(o.get("store_code", "")).lower()
            or s in str(o.get("product_code", "")).lower()
            or s in str(o.get("product_name", "")).lower()
            or s in str(o.get("store_name", "")).lower()
        ]

    total_items = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = filtered[start_idx:end_idx]

    return {
        "run_id": run_id,
        "summary": data.get("summary"),
        "store_summary": data.get("store_summary", []),
        "sku_summary": data.get("sku_summary", []),
        "total_items": total_items,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total_items + page_size - 1) // page_size),
        "items": page_items
    }

@router.get("/planning-runs/{run_id}/exceptions")
def get_planning_run_exceptions(run_id: str):
    data = get_planning_run(run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Planlaşdırma tapılmadı.")
    return {
        "run_id": run_id,
        "exceptions": data.get("exceptions", [])
    }

@router.get("/planning-runs/{run_id}/export")
def export_planning_run_excel(run_id: str):
    data = get_planning_run(run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Planlaşdırma tapılmadı.")

    excel_bytes = generate_distribution_6sheet_excel(
        summary_data=data.get("summary", {}),
        orders_data=data.get("orders", []),
        store_summary=data.get("store_summary", []),
        sku_summary=data.get("sku_summary", []),
        exceptions_data=data.get("exceptions", []),
        parameters_data=data.get("parameters", {})
    )

    filename = f"promo_distribution_{run_id}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
