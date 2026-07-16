from fastapi import APIRouter

from app.auth import CurrentUid

router = APIRouter(tags=["me"])


@router.get("/me/whoami")
def whoami(uid: CurrentUid) -> dict[str, str]:
    """Echo the authenticated uid. Proves auth end-to-end."""
    return {"uid": uid}
