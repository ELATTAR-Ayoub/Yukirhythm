# Yukirhythm API

Python 3.12 + FastAPI backend. Owns user/collection data (via Firebase Admin)
and, from Phase 2B, proxies search to the Next.js engine.

## Local development

```bash
py -3.12 -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8080
```

Interactive docs: http://localhost:8080/docs

## Auth

Clients sign in with Firebase Auth and send the ID token:

```
Authorization: Bearer <firebase-id-token>
```

The server derives `uid` from the verified token only — never from the
request body, query, or path.

## Local credentials

Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path.
**Never commit that file.** On Cloud Run, credentials come from the runtime
service account automatically — no key file needed.

Set `SKIP_FIREBASE_INIT=true` to run without any credentials (tests/CI).

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Server port (Cloud Run injects this) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed browser origins |
| `SKIP_FIREBASE_INIT` | `false` | Skip Admin SDK init (tests/CI) |

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

`--allow-unauthenticated` is correct: the service is publicly reachable, but
every data endpoint requires a valid Firebase ID token. Cloud Run's runtime
service account needs Firestore access.
