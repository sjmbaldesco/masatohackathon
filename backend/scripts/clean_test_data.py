"""
Clean up stray test data from Firestore.

Runs in DRY-RUN mode by default — prints what would be deleted.
Pass --execute to actually delete documents.

Usage:
    python -m scripts.clean_test_data            # dry run
    python -m scripts.clean_test_data --execute  # live delete
"""
import sys
import os

# Allow running from backend/ root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import firebase_service

VALID_ROUTES = {"R01"}
VALID_PASSENGER_STATUSES = {"waiting", "boarded", "departed"}

DRY_RUN = "--execute" not in sys.argv


def log(action: str, collection: str, doc_id: str, reason: str):
    prefix = "[DRY RUN] " if DRY_RUN else "[DELETED]  "
    print(f"{prefix}{action:6s} {collection}/{doc_id}  — {reason}")


def clean_passengers():
    docs = firebase_service.db.collection("passengers").stream()
    for doc in docs:
        d = doc.to_dict()
        reasons = []
        if d.get("route") not in VALID_ROUTES:
            reasons.append(f"route={d.get('route')!r} not in {VALID_ROUTES}")
        if d.get("status") not in VALID_PASSENGER_STATUSES:
            reasons.append(f"status={d.get('status')!r} not valid")
        if reasons:
            log("DELETE", "passengers", doc.id, "; ".join(reasons))
            if not DRY_RUN:
                firebase_service.delete_doc("passengers", doc.id)


def clean_drivers():
    docs = firebase_service.db.collection("drivers").stream()
    for doc in docs:
        d = doc.to_dict()
        reasons = []
        uid = doc.id
        # Flag test UIDs (not Firebase auth UIDs, not demo driver UIDs)
        if uid.startswith("test-") or uid.startswith("fake-"):
            reasons.append(f"uid={uid!r} looks like test data")
        if d.get("route") and d.get("route") not in VALID_ROUTES:
            reasons.append(f"route={d.get('route')!r} not in {VALID_ROUTES}")
        if reasons:
            log("DELETE", "drivers", uid, "; ".join(reasons))
            if not DRY_RUN:
                firebase_service.delete_doc("drivers", uid)


def main():
    print(f"{'=== DRY RUN — pass --execute to delete ===' if DRY_RUN else '=== LIVE DELETE ==='}\n")
    print("Checking passengers …")
    clean_passengers()
    print("\nChecking drivers …")
    clean_drivers()
    print("\nDone.")


if __name__ == "__main__":
    main()
