from fastapi import APIRouter, Depends
from app.middleware.auth_middleware import get_current_user

router = APIRouter()


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """Return the authenticated user's UID and email."""
    return {"uid": user["uid"], "email": user.get("email")}
