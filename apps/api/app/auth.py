from typing import Annotated, Any, cast

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

bearer_scheme = HTTPBearer(auto_error=False)


def verify_id_token(token: str) -> dict[str, Any]:
    """Thin wrapper so tests can substitute verification."""
    # firebase_admin ships no type stubs, so its return is implicitly Any;
    # cast it to the documented shape instead of loosening mypy config.
    return cast("dict[str, Any]", firebase_auth.verify_id_token(token))


def current_uid(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> str:
    """Resolve the caller's uid from a verified Firebase ID token.

    The uid comes from the token only — never from the request body, query, or
    path — so a caller cannot act as another user.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    try:
        decoded = verify_id_token(credentials.credentials)
    except Exception as exc:  # noqa: BLE001 - any failure is an auth failure
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    return str(uid)


CurrentUid = Annotated[str, Depends(current_uid)]
