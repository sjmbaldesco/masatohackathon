"""
Identify which Firestore driver doc belongs to drv-01482,
then delete all other driver docs that are not real accounts.

Keeps: the drv-01482 driver doc (looked up via Firebase Auth by email).
Deletes: all other driver docs in Firestore.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import firebase_service
from firebase_admin import auth

DRY_RUN = "--execute" not in sys.argv

KEEP_EMAILS = [
    "drv01482@pasada.app",
]

def resolve_uid(email):
    try:
        user = auth.get_user_by_email(email)
        return user.uid
    except Exception as e:
        print(f"  Could not resolve {email}: {e}")
        return None

def main():
    print("=== DRY RUN ===" if DRY_RUN else "=== LIVE DELETE ===")

    print("\nResolving keeper UIDs from Firebase Auth...")
    keep_uids = set()
    for email in KEEP_EMAILS:
        uid = resolve_uid(email)
        if uid:
            print(f"  {email} -> {uid}")
            keep_uids.add(uid)

    print(f"\nKeeping {len(keep_uids)} driver(s): {keep_uids}")

    print("\nScanning drivers collection...")
    docs = list(firebase_service.db.collection("drivers").stream())
    for doc in docs:
        if doc.id in keep_uids:
            print(f"  KEEP    drivers/{doc.id}")
        else:
            d = doc.to_dict()
            print(f"  {'[DRY RUN] DELETE' if DRY_RUN else '[DELETED] DELETE'}  drivers/{doc.id}  name={d.get('driver_name','?')}")
            if not DRY_RUN:
                firebase_service.db.collection("drivers").document(doc.id).delete()

    print("\nDone.")

if __name__ == "__main__":
    main()
