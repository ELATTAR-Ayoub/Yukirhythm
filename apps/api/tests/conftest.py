import os

# Firebase must not initialise during tests — no credentials in CI.
os.environ.setdefault("SKIP_FIREBASE_INIT", "true")
