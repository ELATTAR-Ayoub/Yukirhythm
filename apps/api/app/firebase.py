import firebase_admin

from app.config import settings


def init_firebase() -> None:
    """Initialise the Admin SDK once.

    On Cloud Run this uses Application Default Credentials from the runtime
    service account — no key file. Locally, set GOOGLE_APPLICATION_CREDENTIALS.
    Skipped entirely when SKIP_FIREBASE_INIT is set (tests/CI).
    """
    if settings.skip_firebase_init:
        return
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
