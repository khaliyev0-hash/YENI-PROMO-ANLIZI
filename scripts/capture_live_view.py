import subprocess
import sys
import os

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def capture(url="http://localhost:5173", output_path=None, wait_ms=5000, width=1600, height=900):
    if not output_path:
        output_path = os.path.join(os.path.dirname(__file__), "..", "live_view.png")
    output_path = os.path.abspath(output_path)
    
    cmd = [
        EDGE_PATH,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size={width},{height}",
        f"--virtual-time-budget={wait_ms}",
        f"--screenshot={output_path}",
        url
    ]
    
    print(f"Capturing live view of {url} -> {output_path}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(output_path):
        size_kb = os.path.getsize(output_path) / 1024
        print(f"Success: Screenshot saved ({size_kb:.1f} KB)")
        return output_path
    else:
        print("Failed to capture screenshot. Stderr:", res.stderr)
        return None

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
    out = sys.argv[2] if len(sys.argv) > 2 else None
    wait = int(sys.argv[3]) if len(sys.argv) > 3 else 2500
    capture(url, out, wait_ms=wait)
