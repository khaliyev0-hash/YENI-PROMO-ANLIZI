import subprocess
import sys
import os
import time

def main():
    print("=" * 65)
    print("  TAMSTORE PROMO INTELLIGENCE - STARTING PLATFORM")
    print("=" * 65)
    
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")
    
    env = os.environ.copy()
    env["PYTHONPATH"] = backend_dir

    print("\n[1/2] Starting FastAPI Backend on http://localhost:8000...")
    backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    backend_proc = subprocess.Popen(backend_cmd, cwd=root_dir, env=env)

    time.sleep(2)

    print("[2/2] Starting Vite Frontend on http://localhost:5173...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)

    print("\n✅ Platform running successfully!")
    print("• Frontend URL: http://localhost:5173")
    print("• Backend API: http://localhost:8000")
    print("• API Docs:    http://localhost:8000/docs")
    print("\nPress Ctrl+C to terminate both servers.\n")

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping TAMSTORE PROMO INTELLIGENCE servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
