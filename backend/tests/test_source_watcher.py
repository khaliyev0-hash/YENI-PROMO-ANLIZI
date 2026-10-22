import os
import time
import shutil
import tempfile
import pytest
import pandas as pd
from unittest.mock import patch

from app.services.source_service import process_excel_file, resolve_source_path, compute_file_sha256
from app.watcher import SourceWatcher

@pytest.fixture(autouse=True)
def mock_active_store_codes():
    with patch("app.services.source_service.get_active_store_codes", return_value=(
        {"101", "104", "105"},
        {"kept": ["101", "104", "105"], "dropped_status": [], "dropped_type": [], "dropped_conflicting": []}
    )):
        yield

@pytest.fixture
def temp_excel_file():
    temp_dir = tempfile.mkdtemp()
    excel_path = os.path.join(temp_dir, "test_source.xlsx")
    
    df = pd.DataFrame({
        "STORE": ["101", "104"],
        "CODE": ["100001", "100002"],
        "NAME": ["Test Product 1", "Test Product 2"],
        "FC": [50.0, 30.0],
        "START_DATE": ["2026-09-01", "2026-09-01"],
        "END_DATE": ["2026-09-10", "2026-09-10"]
    })
    df.to_excel(excel_path, index=False)
    yield excel_path
    shutil.rmtree(temp_dir, ignore_errors=True)

def test_process_excel_file_basic(temp_excel_file):
    res = process_excel_file(temp_excel_file, trigger="manual")
    assert res is not None
    assert "campaign_id" in res
    assert res["rows"] == 2
    assert res["seconds"] > 0

def test_missing_required_column_fails(temp_excel_file):
    # Overwrite excel missing CODE column
    df = pd.DataFrame({
        "STORE": ["101"],
        "NAME": ["Test"],
        "FC": [10.0],
        "START_DATE": ["2026-09-01"],
        "END_DATE": ["2026-09-10"]
    })
    df.to_excel(temp_excel_file, index=False)
    
    with pytest.raises(ValueError) as excinfo:
        process_excel_file(temp_excel_file, trigger="manual")
    assert "Tələb olunan sütunlar tapılmadı" in str(excinfo.value)
    assert "code" in str(excinfo.value).lower() or "məhsul kodu" in str(excinfo.value).lower()

def test_ignore_temp_files():
    temp_dir = tempfile.mkdtemp()
    try:
        temp_file = os.path.join(temp_dir, "~$test.xlsx")
        with open(temp_file, "w") as f:
            f.write("dummy")
        
        path, is_conf = resolve_source_path(temp_file)
        assert path is None or not os.path.basename(path).startswith("~$")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def test_watcher_idempotent_and_reprocess(temp_excel_file):
    watcher = SourceWatcher()
    
    with patch("app.watcher.resolve_source_path", return_value=(temp_excel_file, True)):
        # First check triggers execution
        watcher._last_seen_mtime = os.path.getmtime(temp_excel_file)
        watcher._last_seen_size = os.path.getsize(temp_excel_file)
        watcher._stable_count = 2
        
        watcher._check_source()
        status1 = watcher.get_status()
        assert status1["state"] == "ok"
        assert status1["campaign_id"] is not None
        first_success = status1["last_success_at"]
        
        # Second check without file change should skip (idempotent)
        watcher._stable_count = 2
        watcher._check_source()
        status2 = watcher.get_status()
        assert status2["last_success_at"] == first_success
        
        # Modify file -> should reprocess
        time.sleep(0.01)
        df = pd.DataFrame({
            "STORE": ["101", "104", "105"],
            "CODE": ["100001", "100002", "100003"],
            "NAME": ["P1", "P2", "P3"],
            "FC": [10.0, 20.0, 30.0],
            "START_DATE": ["2026-09-01", "2026-09-01", "2026-09-01"],
            "END_DATE": ["2026-09-10", "2026-09-10", "2026-09-10"]
        })
        df.to_excel(temp_excel_file, index=False)
        
        watcher._last_seen_mtime = os.path.getmtime(temp_excel_file)
        watcher._last_seen_size = os.path.getsize(temp_excel_file)
        watcher._stable_count = 2
        
        watcher._check_source()
        status3 = watcher.get_status()
        assert status3["state"] == "ok"
        assert status3["rows"] == 3

def test_watcher_locked_file_waiting_state(temp_excel_file):
    watcher = SourceWatcher()
    with patch("app.watcher.resolve_source_path", return_value=(temp_excel_file, True)):
        with patch("app.watcher.process_excel_file", side_effect=PermissionError("File locked by Excel")):
            watcher._last_seen_mtime = os.path.getmtime(temp_excel_file)
            watcher._last_seen_size = os.path.getsize(temp_excel_file)
            watcher._stable_count = 2
            watcher.force_next_run = True
            
            watcher._check_source()
            status = watcher.get_status()
            assert status["state"] == "waiting_file_open"
            assert "Fayl Excel-də açıqdır" in status["progress_stage"]

def test_watcher_coalesced_triggers(temp_excel_file):
    watcher = SourceWatcher()
    with patch("app.watcher.resolve_source_path", return_value=(temp_excel_file, True)):
        watcher.is_processing = True
        started = watcher.trigger_refresh(force=True)
        assert started is False
        assert watcher.pending_run is True
        assert watcher.force_next_run is True
