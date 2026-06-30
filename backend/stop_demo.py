"""
CLI: stop the demo ticker and freeze jeeps.

Usage:
    python stop_demo.py [route_id]   (default: R01)
"""
import sys
import httpx
from pathlib import Path

ROUTE_ID = sys.argv[1] if len(sys.argv) > 1 else "R01"

env_path = Path(__file__).parent.parent / "frontend" / ".env"
api_base = "http://localhost:8000"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("VITE_API_BASE_URL="):
            api_base = line.split("=", 1)[1].strip().rstrip("/")
            break

DEMO_KEY = "pasada-demo-2025"
url = f"{api_base}/demo/{ROUTE_ID}/stop"

print(f"Stopping demo for route {ROUTE_ID} ...")
try:
    r = httpx.post(url, headers={"X-Demo-Key": DEMO_KEY}, timeout=30)
    r.raise_for_status()
    data = r.json()
    print(f"Status: {data.get('status')}")
except httpx.HTTPStatusError as e:
    print(f"HTTP error {e.response.status_code}: {e.response.text}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
