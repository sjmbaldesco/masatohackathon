"""
CLI: seed Firestore with demo jeeps + passengers.

Usage:
    python seed_demo.py [route_id]   (default: R01)
"""
import sys
import httpx
from pathlib import Path

ROUTE_ID = sys.argv[1] if len(sys.argv) > 1 else "R01"

# Read API base URL from frontend/.env
env_path = Path(__file__).parent.parent / "frontend" / ".env"
api_base = "http://localhost:8000"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("VITE_API_BASE_URL="):
            api_base = line.split("=", 1)[1].strip().rstrip("/")
            break

DEMO_KEY = "pasada-demo-2025"
url = f"{api_base}/demo/{ROUTE_ID}/seed"

print(f"Seeding demo data for route {ROUTE_ID} via {url} ...")
try:
    r = httpx.post(url, headers={"X-Demo-Key": DEMO_KEY}, timeout=30)
    r.raise_for_status()
    data = r.json()
    print(f"Done. Drivers seeded: {data.get('drivers_seeded')}, Passengers seeded: {data.get('passengers_seeded')}")
except httpx.HTTPStatusError as e:
    print(f"HTTP error {e.response.status_code}: {e.response.text}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
