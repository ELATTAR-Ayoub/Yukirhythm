# Phase 2 — Backend Separation (Design)

**Date:** 2026-07-16
**Project:** Yukirhythm
**Program:** Full rebuild-grade modernization — Phase 2 of 7 (Phases 0 & 1 shipped)
**Risk:** 🔴 High — re-architecture; moves live data access off the client

---

## Why this phase exists

The owner's goal is a **multi-client product**: web today, **Flutter phones next**, and small "retro-style" hardware (Pi/ESP32-class) later — plus an **agentic/LLM layer** to improve discovery. None of that is possible while the app's data logic lives inside React components calling the Firebase Web SDK directly.

This phase separates frontend from backend: a **standalone Python API** becomes the single backend surface every client talks to.

**Owner decisions locked in:**
- Backend language: **Python** (chosen for a planned agentic/LLM flow — agent frameworks are Python-first).
- Framework: **FastAPI**. Hosting: **Google Cloud Run**. Layout: **monorepo**.
- **The YouTube search engine stays in Next.js** (`apps/web`). Rationale: Node's YouTube ecosystem is materially stronger than Python's, and the engine works. It is not rewritten.
- Player behavior is **out of scope and unchanged** this phase.

## Roadmap (re-sequenced)

| Phase | Name | Status |
|---|---|---|
| 0 | Foundation & Safety Net | ✅ shipped |
| 1 | Correctness & Bug Fixes | ✅ shipped (+ prod migration done) |
| **2** | **Backend Separation** ← *this spec* | 🔨 |
| 3 | Frontend State Cleanup (Zustand) | queued |
| 4 | Dependency Modernization | queued |
| 5 | Design Refresh & Polish | queued |
| 6 | Performance & Longevity | queued |
| later | Flutter client · hardware client · agentic layer | future |

---

## Target architecture

```
repo/
  apps/
    web/          Next.js 14 — UI + /api/searchEngine (the YouTube engine STAYS here)
    api/          Python 3.12 + FastAPI — the backend (Cloud Run)
  packages/
    shared/       Generated TS client + shared contracts
```

**Request flow**

- Browser/Flutter/hardware → **Python API** for everything (users, collections, likes, search).
- Python API `/search` → **proxies to the Next engine** (`apps/web/api/searchEngine`) → returns the same `Audio[]` contract.
  - *Why proxy rather than let clients call Next directly:* one backend surface for all clients, and the future agent (in Python) needs to call search natively. Cost: one extra hop, accepted.
- Python API → **Firestore via `firebase-admin` (Python)** for all reads/writes.

**Auth model** (standard, portable):
1. Clients keep using **Firebase Auth SDKs** client-side (web today; Flutter has a first-class SDK).
2. Client sends the **Firebase ID token** as `Authorization: Bearer <token>`.
3. FastAPI dependency verifies it with `firebase_admin.auth.verify_id_token` → yields the `uid`.
4. **The server derives `uid` from the verified token — never from the request body.** Clients cannot act as another user.

**Security upgrade (important):** once clients no longer write to Firestore, we **lock down Firestore security rules** to deny all direct client access. Today the browser holds write access to your database; after this phase, only the backend can write. This is one of the biggest wins of the phase.

---

## API surface (v1)

All under `/v1`, all requiring a verified Bearer token except where noted.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/health` | liveness (no auth) |
| `POST` | `/v1/search` | `{ query, quantity }` → `Audio[]` (proxies the Next engine) |
| `GET` | `/v1/me` | current user profile |
| `POST` | `/v1/me` | create-if-missing (replaces `ensureUserDoc`) |
| `GET` | `/v1/users/{uid}` | public profile |
| `PUT` | `/v1/me/loved-songs/{audio_id}` | like an audio |
| `DELETE` | `/v1/me/loved-songs/{audio_id}` | unlike |
| `GET` | `/v1/users/{uid}/collections` | list a user's collections |
| `POST` | `/v1/collections` | create a collection |
| `PUT` | `/v1/me/loved-collections/{id}` | like a collection |
| `DELETE` | `/v1/me/loved-collections/{id}` | unlike |

The Firestore document shape is **unchanged** (`{ userData: {...} }`, uid-keyed) — no second data migration. Atomic-write semantics from Phase 1 (transaction for `lovedSongs`, `ArrayUnion`/`ArrayRemove`/`Increment` for collections) are **preserved**, reimplemented with the Python Admin SDK.

**Contracts:** FastAPI auto-generates an **OpenAPI schema**; we code-generate a **typed TS client** into `packages/shared`, consumed by `apps/web`. Frontend and backend contracts cannot silently drift.

---

## Work items

### A. Monorepo restructure
- Move the existing app into `apps/web/` (git history preserved via `git mv`). Create `apps/api/`, `packages/shared/`.
- Root workspace tooling (npm workspaces). Keep Phase 0's gates working: lint/format/typecheck/test/build for `apps/web`, plus Python equivalents for `apps/api`.
- CI extended: Node job (web) + Python job (api).

### B. Python API — walking skeleton first
- `apps/api` with FastAPI, `uv`/`pip-tools` for deps, Ruff (lint/format), mypy (types), pytest.
- `/v1/health` + the auth dependency (`verify_id_token`) + Dockerfile + Cloud Run deploy.
- **Ship this end-to-end before porting any logic** — proves auth, container, and deploy work before business logic is in flight.

### C. Port the data layer to Python
- `firebase-admin` (Python), Firestore client.
- Reimplement, preserving Phase 1 semantics exactly:
  - `ensure_user_doc(uid, data)` — create-if-missing (duplicate accounts stay impossible)
  - `get_user(uid)` / `get_profile_user(uid)` — direct `doc(users/{uid})` reads
  - `like_audio` / `dislike_audio` — **Firestore transaction**, ID-deduped
  - `like_collection` / `dislike_collection` — `ArrayUnion` / `ArrayRemove` + `Increment`
  - `get_user_collections`, `add_collection`
- Pytest unit tests against the **Firestore emulator** (no live data in tests).

### D. `/v1/search` proxy
- Python calls the Next engine over HTTP, preserving the `Audio` contract and Phase 1's status codes (400/404/502/504).
- The Next route gets a **shared-secret header** so only the API can call it (not the public internet).
- Port Phase 1's caching to the API layer (short-TTL), so the agent and all clients benefit.

### E. Web client switches to the API
- `apps/web` stops importing `firebase/firestore` entirely. `AuthContext` keeps **Firebase Auth only** (sign-in + ID token) and calls the generated TS client for all data.
- This collapses most of the 470-line `AuthContext` — the god-file largely dissolves here rather than in Phase 3.
- All Phase 1 behavior preserved (toasts, error handling, dedupe).

### F. Lock down Firestore rules
- Deny all direct client reads/writes to `users` and `collections`; only the Admin SDK (backend) may access them.
- **Deploy order is critical** (see Risks).

### G. Docs
- `apps/api/README.md` (run, test, deploy), root README updated, `.env.example` for both apps.

---

## Non-goals (explicitly deferred)

- **No player changes.** Unchanged this phase.
- **No YouTube engine rewrite.** It stays in Next.
- **No Zustand migration** — Phase 3, and much smaller after (E) shrinks the client.
- **No dependency major upgrades** — Phase 4.
- **No design changes** — Phase 5.
- **No Flutter/hardware client** — future phases; this phase only makes them *possible*.
- **No agentic/LLM features** — future; this phase only creates the Python home for them.
- **No second data migration.** Document shape stays as-is.

---

## Testing strategy

- **Python:** pytest + **Firestore emulator** for the data layer; contract tests per endpoint; auth-dependency tests (valid/invalid/absent token; and that `uid` cannot be spoofed via body).
- **Web:** existing Vitest suite stays green; the generated client is mocked in component tests.
- **Gates:** web (lint/format/typecheck/test/build) + api (ruff/mypy/pytest) all green in CI.
- **Manual smoke (owner, staging):** sign in → profile loads → search returns → like/unlike persists → collections work.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Rules lock-down deployed before the API is live → total outage** | Strict deploy order: API live & verified → web deployed → *then* rules tightened. Rules change is the LAST step, reversible instantly. |
| Big-bang cutover breaks live users | Walking skeleton first; port endpoint-by-endpoint; keep the web client on Firebase until each endpoint is proven; feature-flag the switch if needed |
| Two-language monorepo slows the solo dev | Ruff+mypy+pytest mirror the Node gates; one CI; documented commands |
| Search proxy adds latency / a failure hop | Cache at the API; the Next engine keeps its own timeout; `/v1/search` degrades gracefully (502/504 as in Phase 1) |
| Python Admin SDK semantics differ subtly from the JS SDK | Emulator tests assert Phase 1 semantics (dedupe, atomicity, counters) explicitly |
| Cloud Run cold starts | Acceptable at current scale (~9 users); min-instances if needed later |
| Secrets sprawl (service account, shared secret) | Cloud Run uses its **runtime service account** — no key file. The Next↔API shared secret lives in env/Secret Manager, never in git. |

## Success criteria

All gates green in CI (both apps). The Python API is deployed to Cloud Run and serves every endpoint with verified auth. `apps/web` contains **zero** `firebase/firestore` imports and behaves exactly as it does today. Firestore rules deny direct client access. No user-visible change, no data migration, engine and player untouched.
