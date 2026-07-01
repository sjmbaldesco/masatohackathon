import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.services import firebase_service

print("=== DRIVERS ===")
for doc in firebase_service.db.collection("drivers").stream():
    d = doc.to_dict()
    status = d.get("status", "?")
    occ = d.get("occupancy_count", 0)
    name = d.get("driver_name", "?")
    print(f"  {doc.id[:24]:24s}  status={status:12s}  occ={occ}  name={name}")

print()
print("=== PASSENGERS ===")
passengers = list(firebase_service.db.collection("passengers").stream())
if not passengers:
    print("  (none)")
for doc in passengers:
    d = doc.to_dict()
    print(f"  {doc.id[:24]:24s}  status={d.get('status')}  stop={d.get('stop')}")

print()
print("=== STOPS (non-zero count) ===")
found = False
for doc in firebase_service.db.collection("stops").stream():
    d = doc.to_dict()
    if d.get("count", 0) > 0:
        found = True
        print(f"  {doc.id}  count={d.get('count')}")
if not found:
    print("  (all zero)")
