import os
import json
import time
import threading
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any

from app.config import EXCEL_SOURCE_PATH, get_store_filter_config
from app.services.source_service import resolve_source_path, compute_file_sha256, process_excel_file

def compute_source_signature(filepath: str, reload_env: bool = True) -> str:
    """
    Computes a composite signature of the file content hash + store filter rules.
    If either the file or the store rules change, the signature changes.
    """
    f_hash = compute_file_sha256(filepath)
    status_inc, type_exc = get_store_filter_config(reload_env=reload_env)
    rules_str = f"STATUS:{','.join(sorted(status_inc))}|TYPE_EXC:{','.join(sorted(type_exc))}"
    rules_hash = hashlib.sha256(rules_str.encode('utf-8')).hexdigest()[:16]
    return f"{f_hash}:{rules_hash}"

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
SOURCE_STATE_FILE = os.path.join(DATA_DIR, "source_state.json")

class SourceWatcher:
    def __init__(self):
        self.lock = threading.Lock()
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.is_processing = False
        self.pending_run = False
        self.force_next_run = False
        
        # Poll stabilization tracking
        self._last_seen_mtime: Optional[float] = None
        self._last_seen_size: Optional[int] = None
        self._stable_count = 0
        self._last_freshness_check = 0.0
        
        self.state_data: Dict[str, Any] = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        os.makedirs(DATA_DIR, exist_ok=True)
        if os.path.exists(SOURCE_STATE_FILE):
            try:
                with open(SOURCE_STATE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "path": None,
            "sha256": None,
            "mtime": None,
            "size": None,
            "state": "idle",
            "started_at": None,
            "finished_at": None,
            "rows": 0,
            "seconds": 0.0,
            "campaign_id": None,
            "error": None,
            "warnings_count": 0,
            "last_success_at": None,
            "progress_stage": ""
        }

    def _save_state(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        try:
            with open(SOURCE_STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(self.state_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[WATCHER ERROR] Failed to save source_state.json: {e}")

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True, name="SourceWatcherThread")
        self.thread.start()
        print("[WATCHER] Background source watcher started.")

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        print("[WATCHER] Background source watcher stopped.")

    def trigger_refresh(self, force: bool = True) -> bool:
        """
        Triggers an immediate processing run.
        Returns True if a run was launched (202), or False if a run is already in progress (409).
        """
        with self.lock:
            if self.is_processing:
                self.pending_run = True
                if force:
                    self.force_next_run = True
                return False
            
            self.force_next_run = force
            threading.Thread(target=self._execute_run, daemon=True).start()
            return True

    def get_status(self) -> Dict[str, Any]:
        target_path, is_configured = resolve_source_path()
        file_mtime_iso = None
        if target_path and os.path.exists(target_path) and os.path.isfile(target_path):
            try:
                mtime = os.path.getmtime(target_path)
                file_mtime_iso = datetime.fromtimestamp(mtime).isoformat()
            except Exception:
                pass

        return {
            "configured": is_configured and (target_path is not None and os.path.exists(target_path)),
            "path": target_path or EXCEL_SOURCE_PATH,
            "state": self.state_data.get("state", "idle"),
            "last_success_at": self.state_data.get("last_success_at"),
            "last_error": self.state_data.get("error"),
            "rows": self.state_data.get("rows", 0),
            "seconds": self.state_data.get("seconds", 0.0),
            "campaign_id": self.state_data.get("campaign_id"),
            "file_modified_at": file_mtime_iso,
            "progress_stage": self.state_data.get("progress_stage", "")
        }

    def _check_and_auto_sync_yesterday(self):
        now = time.time()
        if now - self._last_freshness_check < 300: # Check at most once every 5 minutes
            return
        self._last_freshness_check = now

        try:
            from datetime import date, timedelta
            today = date.today()
            yesterday_str = (today - timedelta(days=1)).isoformat()
            meta_path = os.path.join(DATA_DIR, "parquet_cache", "cache_metadata.json")
            needs_sync = False
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                last_synced = meta.get("last_synced_dates", [])
                max_date = meta.get("max_sale_date")
                if yesterday_str not in last_synced and max_date != yesterday_str:
                    needs_sync = True
            else:
                needs_sync = True

            if needs_sync:
                print(f"[WATCHER AUTO-SYNC] Dünənin ({yesterday_str}) satışları keşdə tapılmadı. Avtomatik sinxronizasiya edilir...", flush=True)
                from scripts.sync_daily_sales import sync_dates_sales
                sync_dates_sales([yesterday_str])
                self.force_next_run = True
        except Exception as e:
            print(f"[WATCHER AUTO-SYNC WARNING] {e}", flush=True)

    def _loop(self):
        time.sleep(1.0)
        self._check_and_auto_sync_yesterday()
        self._check_source()

        while self.running:
            for _ in range(10):
                if not self.running:
                    break
                time.sleep(1.0)

            if self.running:
                self._check_and_auto_sync_yesterday()
                self._check_source()

    def _check_source(self):
        if self.is_processing:
            return

        target_path, is_configured = resolve_source_path()
        if not is_configured or not target_path or not os.path.exists(target_path) or not os.path.isfile(target_path):
            return

        try:
            mtime = os.path.getmtime(target_path)
            size = os.path.getsize(target_path)
        except Exception:
            return

        # Check stabilization: 2 consecutive polls unchanged
        if mtime == self._last_seen_mtime and size == self._last_seen_size:
            self._stable_count += 1
        else:
            self._last_seen_mtime = mtime
            self._last_seen_size = size
            self._stable_count = 1

        if self._stable_count < 2:
            return

        # Check signature or force flag
        force = self.force_next_run
        last_sig = self.state_data.get("sha256")
        
        if not force and last_sig and self.state_data.get("state") == "ok":
            try:
                curr_sig = compute_source_signature(target_path)
                if curr_sig == last_sig:
                    return # Idempotent skip
            except Exception:
                pass

        # Trigger run
        self._execute_run()

    def _execute_run(self):
        with self.lock:
            if self.is_processing:
                self.pending_run = True
                return
            self.is_processing = True
            force = self.force_next_run
            self.force_next_run = False

        target_path, is_configured = resolve_source_path()
        if not target_path or not os.path.exists(target_path):
            with self.lock:
                self.is_processing = False
                self.state_data["state"] = "error"
                self.state_data["error"] = f"Mənbə faylı tapılmadı: {target_path}"
                self._save_state()
            return

        try:
            mtime = os.path.getmtime(target_path)
            size = os.path.getsize(target_path)
        except Exception:
            mtime = None
            size = None

        # State: processing
        now_iso = datetime.now().isoformat()
        self.state_data["state"] = "processing"
        self.state_data["path"] = target_path
        self.state_data["started_at"] = now_iso
        self.state_data["error"] = None
        self.state_data["progress_stage"] = "Emal edilir..."
        self._save_state()

        def update_stage(msg: str):
            self.state_data["progress_stage"] = msg
            self._save_state()

        try:
            file_sig = compute_source_signature(target_path)
            
            # Run pipeline
            res = process_excel_file(
                file_path=target_path,
                trigger="auto",
                original_filename=os.path.basename(target_path),
                progress_callback=update_stage
            )

            # Success
            finished_iso = datetime.now().isoformat()
            self.state_data["state"] = "ok"
            self.state_data["sha256"] = file_sig
            self.state_data["mtime"] = mtime
            self.state_data["size"] = size
            self.state_data["finished_at"] = finished_iso
            self.state_data["last_success_at"] = finished_iso
            self.state_data["rows"] = res.get("rows", 0)
            self.state_data["seconds"] = res.get("seconds", 0.0)
            self.state_data["campaign_id"] = res.get("campaign_id")
            self.state_data["error"] = None
            self.state_data["progress_stage"] = "Tamamlandı ✓"
            self._save_state()
            print(f"[WATCHER] Source processing finished successfully in {res.get('seconds')}s.")

        except PermissionError as pe:
            print(f"[WATCHER] File lock detected: {pe}")
            self.state_data["state"] = "waiting_file_open"
            self.state_data["progress_stage"] = "Fayl Excel-də açıqdır, gözlənilir"
            self.state_data["error"] = str(pe)
            self._save_state()

        except Exception as err:
            finished_iso = datetime.now().isoformat()
            print(f"[WATCHER ERROR] Source processing failed: {err}")
            self.state_data["state"] = "error"
            self.state_data["finished_at"] = finished_iso
            self.state_data["error"] = str(err)
            self.state_data["progress_stage"] = f"Xəta: {str(err)}"
            self._save_state()

        finally:
            with self.lock:
                self.is_processing = False
                should_rerun = self.pending_run
                self.pending_run = False

            if should_rerun:
                print("[WATCHER] Coalesced trigger pending, re-executing run...")
                self._execute_run()

watcher = SourceWatcher()
