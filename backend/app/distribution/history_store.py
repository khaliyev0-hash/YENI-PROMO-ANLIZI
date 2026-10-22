import os
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
RUNS_DIR = os.path.join(DATA_DIR, "planning_runs")
os.makedirs(RUNS_DIR, exist_ok=True)

class PlanningRunMetadata(BaseModel):
    id: str
    title: str
    status: str = "completed"  # pending, running, completed, failed
    created_at: str
    start_date: str
    end_date: str
    duration_days: int
    store_count: int
    product_count: int
    total_forecast_demand: float
    total_recommended_order_units: float
    total_recommended_cases: int
    warning_count: int
    exception_count: int
    version: str = "v1.0"
    created_by: str = "Admin"
    confirmation_status: str = "DRAFT"  # DRAFT, CONFIRMED, REJECTED

class PlanningRunDetail(BaseModel):
    metadata: PlanningRunMetadata
    summary: Dict[str, Any]
    parameters: Dict[str, Any]
    orders: List[Dict[str, Any]]
    store_summary: List[Dict[str, Any]]
    sku_summary: List[Dict[str, Any]]
    exceptions: List[Dict[str, Any]]

def save_planning_run(
    title: str,
    start_date: str,
    end_date: str,
    duration_days: int,
    summary: Dict[str, Any],
    parameters: Dict[str, Any],
    orders: List[Dict[str, Any]],
    store_summary: List[Dict[str, Any]],
    sku_summary: List[Dict[str, Any]],
    exceptions: List[Dict[str, Any]],
    run_id: Optional[str] = None
) -> str:
    """Saves a complete planning run to disk."""
    if not run_id:
        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid.uuid4())[:8]}"

    meta = PlanningRunMetadata(
        id=run_id,
        title=title,
        status="completed",
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        start_date=start_date,
        end_date=end_date,
        duration_days=duration_days,
        store_count=summary.get("store_count", 0),
        product_count=summary.get("product_count", 0),
        total_forecast_demand=summary.get("total_forecast_demand", 0.0),
        total_recommended_order_units=summary.get("total_recommended_order_units", 0.0),
        total_recommended_cases=summary.get("total_recommended_cases", 0),
        warning_count=summary.get("warning_count", 0),
        exception_count=len(exceptions),
        version="v1.0",
        confirmation_status="DRAFT"
    )

    full_payload = {
        "metadata": meta.model_dump(),
        "summary": summary,
        "parameters": parameters,
        "orders": orders,
        "store_summary": store_summary,
        "sku_summary": sku_summary,
        "exceptions": exceptions
    }

    file_path = os.path.join(RUNS_DIR, f"{run_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(full_payload, f, ensure_ascii=False, indent=2)

    return run_id

def list_planning_runs() -> List[PlanningRunMetadata]:
    """Lists all saved planning runs ordered by creation date descending."""
    runs: List[PlanningRunMetadata] = []
    if not os.path.exists(RUNS_DIR):
        return []

    for fname in os.listdir(RUNS_DIR):
        if fname.endswith(".json"):
            fp = os.path.join(RUNS_DIR, fname)
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    meta = data.get("metadata")
                    if meta:
                        runs.append(PlanningRunMetadata(**meta))
            except Exception as e:
                print(f"Error reading {fp}: {e}")

    runs.sort(key=lambda x: x.created_at, reverse=True)
    return runs

def get_planning_run(run_id: str) -> Optional[Dict[str, Any]]:
    """Loads a planning run by ID."""
    fp = os.path.join(RUNS_DIR, f"{run_id}.json")
    if not os.path.exists(fp):
        return None
    try:
        with open(fp, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading planning run {run_id}: {e}")
        return None
