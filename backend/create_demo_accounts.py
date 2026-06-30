"""
Create demo Firebase Auth users + Firestore role docs for simulation testing.

Usage (from backend/):
    python create_demo_accounts.py
"""
import sys
sys.path.insert(0, ".")

from datetime import datetime, timezone
from app.services import firebase_service
import firebase_admin
from firebase_admin import auth


def get_or_create(email, password, display_name):
    try:
        user = auth.get_user_by_email(email)
        print(f"  Already exists: {email} ({user.uid})")
    except auth.UserNotFoundError:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
        )
        print(f"  Created: {email} ({user.uid})")
    return user


def main():
    now = datetime.now(timezone.utc).isoformat()

    # ── Driver: DRV-01482 ─────────────────────────────────────────────────────
    print("DRV-01482:")
    u = get_or_create("drv01482@pasada.app", "1482", "Jairus Macabuhay")
    firebase_service.set_doc("users", u.uid, {
        "uid": u.uid,
        "role": "driver",
        "email": "drv01482@pasada.app",
        "createdAt": now,
    })
    firebase_service.set_doc("drivers", u.uid, {
        "uid": u.uid,
        "driver_name": "Jairus Macabuhay",
        "plate": "PAS 1482",
        "route": "R01",
        "capacity": 18,
        "occupancy_count": 0,
        "occupancy_pct": 0,
        "speed_kmh": 0,
        "lat": 14.2989101,
        "lng": 121.4637842,
        "current_stop": "Lumban",
        "status": "idle",
        "last_updated": now,
    }, merge=True)
    print(f"  users/{u.uid} = driver | drivers/{u.uid} = idle at Lumban\n")

    # ── Passenger dummy ───────────────────────────────────────────────────────
    print("Passenger dummy:")
    u = get_or_create("passenger@pasada.app", "pass1234", "Test Passenger")
    firebase_service.set_doc("users", u.uid, {
        "uid": u.uid,
        "role": "passenger",
        "email": "passenger@pasada.app",
        "createdAt": now,
    })
    print(f"  users/{u.uid} = passenger\n")

    # ── Admin dummy ───────────────────────────────────────────────────────────
    print("Admin dummy:")
    u = get_or_create("admin@pasada.app", "admin1234", "Admin User")
    firebase_service.set_doc("users", u.uid, {
        "uid": u.uid,
        "role": "admin",
        "email": "admin@pasada.app",
        "createdAt": now,
    })
    print(f"  users/{u.uid} = admin\n")

    print("=" * 50)
    print("Login credentials for simulation:")
    print("  Driver:    DRV-01482   | PIN: 1482")
    print("  Passenger: passenger@pasada.app | pass1234")
    print("  Admin:     admin@pasada.app     | admin1234")


main()
