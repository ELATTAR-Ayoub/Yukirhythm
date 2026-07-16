# Phase 2A — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure into a monorepo and stand up a deployable Python FastAPI service with working Firebase ID-token auth and CI — proving the whole pipeline end-to-end **before** any business logic is ported.

**Architecture:** `apps/web` (existing Next.js, unchanged behavior) + `apps/api` (new Python 3.12 / FastAPI, Cloud Run) + `packages/shared` (placeholder for the generated TS client in 2B). No data logic moves in this plan. No user-visible change.

**Tech Stack:** Next.js 14 (existing), Python 3.12, FastAPI, firebase-admin (Python), pytest, Ruff, mypy, Docker, Google Cloud Run, GitHub Actions, npm workspaces.

**Working branch:** `phase-2-backend-separation` (created; spec committed there).

**Phase 2 milestones:** **2A = this plan (skeleton)** → 2B (data layer + endpoints + search proxy) → 2C (web cutover + Firestore rules lockdown).

**Context for the engineer:**
- Repo root today: a single Next.js 14 app (App Router in `app/`, plus `pages/api/searchEngine.ts`). Phase 0 gates exist: `lint`, `format:check`, `typecheck`, `test`, `build`. CI: `.github/workflows/ci.yml`. Node pinned to 20 via `.nvmrc`.
- Firebase project: `yukirythem-a38dd`. Firestore users are **uid-keyed** (`users/{uid}`) with body `{ userData: {...} }` (migration already done).
- `.env` (real, gitignored) and `.env.example` exist at the repo root today — they move with the web app.
- **Do NOT** change app behavior, the player, or the YouTube engine in this plan.
- Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Windows dev box (PowerShell), `core.autocrlf=true`, `.gitattributes` enforces LF.

---

## File structure after 2A

```
/                       root workspace (npm workspaces)
  package.json          workspaces: apps/web, packages/*
  .github/workflows/ci.yml    two jobs: web (Node) + api (Python)
  apps/
    web/                ← everything that is at the repo root today
    api/
      pyproject.toml
      Dockerfile
      .dockerignore
      README.md
      app/
        __init__.py
        main.py         FastAPI app factory + router wiring
        config.py       env settings (pydantic-settings)
        firebase.py     Admin SDK init (ADC on Cloud Run)
        auth.py         Bearer -> verified uid dependency
        routers/
          __init__.py
          health.py     GET /v1/health
      tests/
        __init__.py
        conftest.py
        test_health.py
        test_auth.py
  packages/
    shared/             placeholder (populated in 2B)
```

---

## Task 1: Move the app into `apps/web`

**Files:** everything at repo root → `apps/web/`; new root `package.json`.

- [ ] **Step 1: Move tracked files with git (preserves history)**

From the repo root, move the app into `apps/web/`. Move **all** app files and dirs, but LEAVE these at the root: `.git/`, `.github/`, `docs/`, `.gitattributes`, and `.gitignore` (root-level ignore stays).

```bash
mkdir -p apps/web
git mv app apps/web/app
git mv pages apps/web/pages
git mv components apps/web/components
git mv sections apps/web/sections
git mv lib apps/web/lib
git mv store apps/web/store
git mv context apps/web/context
git mv config apps/web/config
git mv constants apps/web/constants
git mv utils apps/web/utils
git mv styles apps/web/styles
git mv public apps/web/public
git mv scripts apps/web/scripts
git mv __tests__ apps/web/__tests__
git mv package.json apps/web/package.json
git mv package-lock.json apps/web/package-lock.json
git mv tsconfig.json apps/web/tsconfig.json
git mv next.config.js apps/web/next.config.js
git mv tailwind.config.js apps/web/tailwind.config.js
git mv postcss.config.js apps/web/postcss.config.js
git mv components.json apps/web/components.json
git mv vitest.config.ts apps/web/vitest.config.ts
git mv vitest.setup.ts apps/web/vitest.setup.ts
git mv .eslintrc.json apps/web/.eslintrc.json
git mv .prettierrc apps/web/.prettierrc
git mv .prettierignore apps/web/.prettierignore
git mv .env.example apps/web/.env.example
git mv .nvmrc apps/web/.nvmrc
git mv toDo apps/web/toDo
git mv README.md apps/web/README.md
```
Also move the untracked-but-real `.env` (NOT tracked by git — move it with the filesystem so local dev keeps working):
```bash
mv .env apps/web/.env 2>/dev/null || true
```
If any listed path does not exist, skip it. If any file exists at root that is NOT listed and is NOT one of the keep-at-root items, STOP and report it rather than guessing.

- [ ] **Step 2: Create the root workspace `package.json`**

```json
{
  "name": "yukirhythm",
  "private": true,
  "workspaces": ["apps/web", "packages/*"],
  "engines": {
    "node": ">=20 <23"
  },
  "scripts": {
    "web": "npm run --workspace apps/web",
    "lint": "npm run lint --workspace apps/web",
    "format:check": "npm run format:check --workspace apps/web",
    "typecheck": "npm run typecheck --workspace apps/web",
    "test": "npm run test --workspace apps/web",
    "build": "npm run build --workspace apps/web"
  }
}
```

- [ ] **Step 3: Add a root `.nvmrc`** (CI reads it from the root)

```
20
```

- [ ] **Step 4: Reinstall and verify every gate still passes**

```bash
npm install
npm run lint
npm run typecheck
npm run test
```
Expected: all pass (19 tests). Then build from the web workspace with the real `.env` now at `apps/web/.env`:
```bash
npm run build
```
Expected: compiles. If a path breaks (e.g. `tsconfig` `paths`, vitest alias, or the `@/` alias), fix it **inside `apps/web`** — the alias is relative to `apps/web` now and should keep working unchanged since all files moved together. Report anything that needed changing.

- [ ] **Step 5: Update `.github/workflows/ci.yml` for the new paths**

The existing job must run from `apps/web`. Change the job to add a working-directory default and use the root `.nvmrc`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    env:
      NEXT_PUBLIC_APIKEY: ci-placeholder
      NEXT_PUBLIC_AUTHDOMAIN: ci-placeholder.firebaseapp.com
      NEXT_PUBLIC_PROJECTID: ci-placeholder
      NEXT_PUBLIC_STORAGEBUCKET: ci-placeholder.appspot.com
      NEXT_PUBLIC_MESSAGINGSENDERID: "0000000000"
      NEXT_PUBLIC_APPID: ci-placeholder
      NEXT_PUBLIC_MEASUREMENTID: G-CIPLACEHOLDER
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(repo): move the app into apps/web and add npm workspaces

Monorepo groundwork for the Python API. No behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Confirm `git status` shows no `.env` staged.

---

## Task 2: Scaffold the Python API

**Files:** `apps/api/pyproject.toml`, `apps/api/app/**`, `apps/api/tests/**`, `apps/api/README.md`.

- [ ] **Step 1: Create `apps/api/pyproject.toml`**

```toml
[project]
name = "yukirhythm-api"
version = "0.1.0"
description = "Yukirhythm backend API"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "firebase-admin>=6.5",
  "httpx>=0.27",
  "pydantic>=2.9",
  "pydantic-settings>=2.6",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3",
  "ruff>=0.7",
  "mypy>=1.13",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]

[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Create the app package**

`apps/api/app/__init__.py` — empty file.

`apps/api/app/config.py`:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Set by Cloud Run; used for local runs too.
    port: int = 8080
    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
```

`apps/api/app/firebase.py`:
```python
import firebase_admin


def init_firebase() -> None:
    """Initialise the Admin SDK once.

    On Cloud Run this uses Application Default Credentials from the service
    account — no key file. Locally, set GOOGLE_APPLICATION_CREDENTIALS.
    """
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
```

`apps/api/app/routers/__init__.py` — empty file.

`apps/api/app/routers/health.py`:
```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. No auth."""
    return {"status": "ok"}
```

`apps/api/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.firebase import init_firebase
from app.routers import health


def create_app() -> FastAPI:
    init_firebase()
    app = FastAPI(title="Yukirhythm API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, prefix="/v1")
    return app


app = create_app()
```

- [ ] **Step 3: Write the health test** — `apps/api/tests/__init__.py` (empty) and `apps/api/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: Install and run the test**

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
```
Expected: 1 test passes.
NOTE: `init_firebase()` runs at import. Without credentials locally it may raise. If `pytest` fails because Firebase can't initialise, make `init_firebase()` tolerant: wrap `firebase_admin.initialize_app()` in a `try/except Exception` that logs and continues **only when no credentials are configured**, OR have `create_app()` skip init when the env var `YUKI_SKIP_FIREBASE_INIT=1`. Prefer the env-var approach (explicit) and set it in `tests/conftest.py`. Report which you used.

- [ ] **Step 5: Run the Python gates**

```bash
ruff check .
ruff format --check .
mypy app
```
Expected: all clean. Fix anything trivial they surface.

- [ ] **Step 6: Add `apps/api/.gitignore`**

```
.venv/
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/
.ruff_cache/
.env
```

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold FastAPI service with health endpoint

Python 3.12 + FastAPI + Ruff/mypy/pytest. Health probe only; no data logic.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Firebase ID-token auth dependency

**Files:** `apps/api/app/auth.py`, `apps/api/app/routers/me.py`, `apps/api/tests/test_auth.py`.

The security rule that matters: **`uid` comes from the verified token, never from the request.**

- [ ] **Step 1: Write the failing test** — `apps/api/tests/test_auth.py`

```python
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def fake_verify(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    def _verify(token: str) -> dict[str, str]:
        if token == "good-token":
            return {"uid": "uid-123"}
        raise ValueError("bad token")

    monkeypatch.setattr("app.auth.verify_id_token", _verify)
    yield


def test_whoami_rejects_missing_token() -> None:
    response = client.get("/v1/me/whoami")
    assert response.status_code == 401


def test_whoami_rejects_invalid_token(fake_verify: None) -> None:
    response = client.get(
        "/v1/me/whoami", headers={"Authorization": "Bearer nonsense"}
    )
    assert response.status_code == 401


def test_whoami_returns_uid_from_token(fake_verify: None) -> None:
    response = client.get(
        "/v1/me/whoami", headers={"Authorization": "Bearer good-token"}
    )
    assert response.status_code == 200
    assert response.json() == {"uid": "uid-123"}
```

- [ ] **Step 2: Run it — confirm it FAILS** (`/v1/me/whoami` does not exist yet)

```bash
pytest tests/test_auth.py
```
Expected: 404s / import errors — not passes.

- [ ] **Step 3: Implement `apps/api/app/auth.py`**

```python
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

bearer_scheme = HTTPBearer(auto_error=False)


def verify_id_token(token: str) -> dict[str, Any]:
    """Wrapper so tests can substitute verification."""
    return firebase_auth.verify_id_token(token)


def current_uid(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> str:
    """Resolve the caller's uid from a verified Firebase ID token.

    The uid is taken from the token only — never from the request body or
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
```

- [ ] **Step 4: Add the probe route** — `apps/api/app/routers/me.py`

```python
from fastapi import APIRouter

from app.auth import CurrentUid

router = APIRouter(tags=["me"])


@router.get("/me/whoami")
def whoami(uid: CurrentUid) -> dict[str, str]:
    """Echo the authenticated uid. Proves auth end-to-end."""
    return {"uid": uid}
```

Wire it in `apps/api/app/main.py`: add `from app.routers import health, me` and `app.include_router(me.router, prefix="/v1")`.

- [ ] **Step 5: Run tests — confirm PASS**

```bash
pytest
```
Expected: 4 tests pass (1 health + 3 auth).

- [ ] **Step 6: Gates + commit**

```bash
ruff check . && ruff format --check . && mypy app && pytest
git add apps/api
git commit -m "feat(api): verify Firebase ID tokens and expose /v1/me/whoami

uid is derived from the verified token only, never from the request.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Containerise for Cloud Run

**Files:** `apps/api/Dockerfile`, `apps/api/.dockerignore`, `apps/api/README.md`.

- [ ] **Step 1: `apps/api/Dockerfile`**

```dockerfile
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY app ./app

# Cloud Run injects PORT.
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
```

- [ ] **Step 2: `apps/api/.dockerignore`**

```
.venv
__pycache__
*.pyc
.pytest_cache
.mypy_cache
.ruff_cache
tests
.env
README.md
```

- [ ] **Step 3: Build the image locally to prove it works**

```bash
cd apps/api
docker build -t yukirhythm-api:dev .
```
Expected: builds successfully.
If Docker is unavailable on this machine, SKIP the build, say so in your report, and do not fake it — the CI job in Task 5 will validate it instead.

- [ ] **Step 4: `apps/api/README.md`**

````markdown
# Yukirhythm API

Python 3.12 + FastAPI backend. Owns user/collection data (via Firebase Admin)
and, from Phase 2B, proxies search to the Next.js engine.

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8080
```

Docs: http://localhost:8080/docs

## Auth

Clients sign in with Firebase Auth and send the ID token:

```
Authorization: Bearer <firebase-id-token>
```

The server derives `uid` from the verified token only.

## Local credentials

Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path.
**Never commit that file.** On Cloud Run, credentials come from the
runtime service account automatically — no key file.

## Checks

```bash
ruff check . && ruff format --check . && mypy app && pytest
```

## Deploy (Cloud Run)

```bash
gcloud run deploy yukirhythm-api \
  --source . \
  --region <region> \
  --project yukirythem-a38dd \
  --allow-unauthenticated \
  --set-env-vars CORS_ORIGINS=https://<your-web-domain>
```

`--allow-unauthenticated` is correct here: the API is public, but every
data endpoint requires a valid Firebase ID token.
````

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "build(api): containerise for Cloud Run + document local dev

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: CI for both apps

**Files:** `.github/workflows/ci.yml`.

- [ ] **Step 1: Add an `api` job** alongside the existing `web` job (keep `web` exactly as Task 1 left it)

```yaml
  api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    env:
      YUKI_SKIP_FIREBASE_INIT: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: ruff format --check .
      - run: mypy app
      - run: pytest
      - name: Build container
        run: docker build -t yukirhythm-api:ci .
```
(If Task 2 Step 4 used a different mechanism than `YUKI_SKIP_FIREBASE_INIT`, use that instead and keep it consistent.)

- [ ] **Step 2: Verify the full pipeline locally, in CI order**

```bash
# root
npm ci && npm run lint && npm run format:check && npm run typecheck && npm test
# api
cd apps/api && ruff check . && ruff format --check . && mypy app && pytest
```
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Python API job alongside the web job

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Placeholder for the shared package

**Files:** `packages/shared/README.md`.

- [ ] **Step 1: Create `packages/shared/README.md`**

```markdown
# @yukirhythm/shared

Shared contracts between the API and its clients.

In Phase 2B this package will hold a **TypeScript client generated from the
API's OpenAPI schema** (FastAPI publishes it at `/openapi.json`), so the web
app and backend can never drift out of sync.

Empty placeholder for now — do not add hand-written types here; they will be
generated.
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared
git commit -m "chore(shared): add placeholder for the generated API client

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Definition of Done (2A)

- [ ] The Next.js app lives in `apps/web` and behaves **identically**; all Phase 0/1 gates pass (lint, format:check, typecheck, 19 tests, build).
- [ ] `apps/api` runs locally: `GET /v1/health` → `{"status":"ok"}`.
- [ ] `GET /v1/me/whoami` returns the uid for a valid Firebase ID token, and **401** for missing/invalid tokens — proven by tests.
- [ ] Ruff, mypy (strict), and pytest all pass for the API.
- [ ] The API container builds.
- [ ] CI runs **both** jobs green.
- [ ] No `.env` or service-account key committed. No user-visible change. No data logic moved.

## Owner step (not done by us)

Deploying to Cloud Run the first time is an owner action (needs `gcloud` auth against `yukirythem-a38dd`):
```bash
cd apps/api
gcloud run deploy yukirhythm-api --source . --region <region> \
  --project yukirythem-a38dd --allow-unauthenticated
```
Then verify: `curl https://<service-url>/v1/health` → `{"status":"ok"}`.

## Self-review notes (author)

- **Spec coverage:** spec §A (monorepo) → Task 1; §B (walking skeleton: FastAPI, auth, Docker, Cloud Run) → Tasks 2–4; CI → Task 5; `packages/shared` placeholder → Task 6. Spec §C–F (data layer, search proxy, web cutover, rules lockdown) are **deliberately deferred to 2B/2C**. ✅
- **Placeholder scan:** every step has real content; the only intentional placeholder is `packages/shared`, which the spec defines as populated in 2B. ✅
- **Naming consistency:** `current_uid` / `CurrentUid` / `verify_id_token` are used identically across `auth.py`, `me.py`, and the tests. The Firebase-init skip mechanism must match between Task 2 Step 4 and the CI env var in Task 5. ✅
- **Risk:** Task 1 is a large mechanical move; the mitigation is running every gate immediately after (Step 4) before anything else is built on top.
