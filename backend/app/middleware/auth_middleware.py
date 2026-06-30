from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.firebase_service import verify_id_token

bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — verifies the Firebase ID token in the Authorization header.
    Returns the decoded token claims (uid, email, etc.).
    Raises 401 if invalid.
    """
    try:
        return verify_id_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme_optional),
) -> Optional[dict]:
    """Like get_current_user but returns None instead of raising when no/invalid token."""
    if credentials is None:
        return None
    try:
        return verify_id_token(credentials.credentials)
    except Exception:
        return None
