"""
Demo mode API endpoints.

Auth: accepts either:
  - X-Demo-Key: pasada-demo-2025 header (no Firebase token needed)
  - A valid Firebase token for an admin or driver role
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import settings
from app.middleware.auth_middleware import get_current_user_optional
from app.services import demo_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def demo_auth(
    x_demo_key: Optional[str] = Header(default=None, alias="X-Demo-Key"),
    user: Optional[dict] = Depends(get_current_user_optional),
) -> bool:
    """Passes if caller supplies the demo key OR is an authenticated admin/driver."""
    if x_demo_key == settings.demo_key:
        return True
    if user is not None:
        role = user.get("role") or user.get("custom_claims", {}).get("role", "")
        if role in ("admin", "driver"):
            return True
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Provide X-Demo-Key header or authenticate as admin/driver",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{route_id}/seed")
def seed(route_id: str, _: bool = Depends(demo_auth)):
    """Seed Firestore with demo drivers and passengers. Idempotent."""
    try:
        result = demo_service.seed_demo(route_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result


@router.post("/{route_id}/start")
async def start(route_id: str, _: bool = Depends(demo_auth)):
    """Start the real-time demo ticker for the route."""
    try:
        result = await demo_service.start_demo(route_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result


@router.post("/{route_id}/stop")
async def stop(route_id: str, _: bool = Depends(demo_auth)):
    """Stop the demo ticker and freeze jeeps."""
    return await demo_service.stop_demo(route_id)


@router.get("/{route_id}/status")
def get_status(route_id: str, _: bool = Depends(demo_auth)):
    """Return whether the demo is currently running."""
    return {
        "route_id": route_id,
        "running": demo_service.is_running(route_id),
    }


@router.delete("/{route_id}")
async def clear(route_id: str, _: bool = Depends(demo_auth)):
    """Stop demo (if running) and delete all demo docs from Firestore."""
    if demo_service.is_running(route_id):
        await demo_service.stop_demo(route_id)
    try:
        result = demo_service.clear_demo(route_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    return result
