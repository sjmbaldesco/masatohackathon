"""
Full Firestore cleanup — removes all demo/test data and resets driver state.

Targets:
  - drivers/  : deletes all demo-* docs; resets real drivers to idle/0 occupancy
  - passengers/: deletes ALL docs (clears waiting signals and demo passengers)
  - stops/    : resets count to 0 on all R01 stops

Runs DRY-RUN by default. Pass --execute to apply.

Usage:
    python -m scripts.nuke_demo             # dry run
    python -m scripts.nuke_demo --execute   # live
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import firebase_service

DRY_RUN = "--execute" not in sys.argv


def tag(action: str, collection: str, doc_id: str, note: str = ""):
    prefix = "[DRY RUN]" if DRY_RUN else "[DONE]   "
    print(f"{prefix} {action:6s}  {collection}/{doc_id}  {note}")


def nuke_passengers():
    print("\n-- passengers --")
    docs = list(firebase_service.db.collection("passengers").stream())
    if not docs:
        print("  (empty)")
        return
    for doc in docs:
        d = doc.to_dict()
        note = f"status={d.get('status')!r}  stop={d.get('stop')!r}"
        tag("DELETE", "passengers", doc.id, note)
        if not DRY_RUN:
            firebase_service.db.collection("passengers").document(doc.id).delete()


def nuke_demo_drivers():
    print("\n-- drivers (demo-*) --")
    docs = list(firebase_service.db.collection("drivers").stream())
    demo_found = False
    for doc in docs:
        if doc.id.startswith("demo-"):
            demo_found = True
            tag("DELETE", "drivers", doc.id)
            if not DRY_RUN:
                firebase_service.db.collection("drivers").document(doc.id).delete()
    if not demo_found:
        print("  (no demo-* drivers found)")


def reset_real_drivers():
    print("\n-- drivers (real -- reset to idle) --")
    docs = list(firebase_service.db.collection("drivers").stream())
    real_found = False
    for doc in docs:
        if doc.id.startswith("demo-"):
            continue
        real_found = True
        tag("RESET ", "drivers", doc.id, "-> idle, occupancy 0")
        if not DRY_RUN:
            firebase_service.db.collection("drivers").document(doc.id).update({
                "status": "idle",
                "occupancy_count": 0,
                "occupancy_pct": 0,
                "speed_kmh": 0,
            })
    if not real_found:
        print("  (no real drivers found)")


def reset_stop_counts():
    print("\n-- stops (reset count to 0) --")
    docs = list(firebase_service.db.collection("stops").stream())
    if not docs:
        print("  (empty)")
        return
    for doc in docs:
        tag("RESET ", "stops", doc.id, "count -> 0")
        if not DRY_RUN:
            firebase_service.db.collection("stops").document(doc.id).update({"count": 0})


def main():
    mode = "=== DRY RUN — pass --execute to apply ===" if DRY_RUN else "=== LIVE DELETE ==="
    print(mode)
    nuke_passengers()
    nuke_demo_drivers()
    reset_real_drivers()
    reset_stop_counts()
    print("\nDone.")


if __name__ == "__main__":
    main()
