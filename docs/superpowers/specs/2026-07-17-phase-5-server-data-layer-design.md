# Phase 5 — Server-Side Data Layer + Firestore Lockdown (Design)

**Date:** 2026-07-17
**Project:** Yukirhythm
**Branch:** `v2_2026`
**Risk:** 🔴 High — moves live data access off the client; one irreversible-feeling deploy-order requirement

---

## Goal

Move all Firestore access out of the browser and into **Next Route Handlers backed by Firebase Admin**, then **lock down the Firestore security rules** so no client can touch the database directly.

## Why

**Right now, any browser can write to your database.** The Firebase Web SDK talks to Firestore straight from the client, so your data's only protection is whatever rules sit (unversioned) in the console. Every `like`, `collection`, and profile write is client-issued and client-trusted.

After this phase, the browser holds **zero** database credentials, and the rules deny all direct access. That's the single biggest security improvement available to this codebase.

**Secondary benefit:** it produces a real HTTP API — which is exactly what a future Flutter client or hardware device would call.

---

## ⚠️ The real cost, stated up front

**Today the app needs only 7 public `NEXT_PUBLIC_*` values.** After this phase, the **server needs a Firebase service-account credential** — a genuine secret, configured in Vercel.

That is a permanent operational change: a secret to store, rotate, and keep out of git. It is the price of the security win, and it should be a conscious trade, not a surprise.

*(Note: the service-account key generated during the Phase 1 migration was exposed in a chat transcript and should be revoked. Phase 5 needs a **fresh** key.)*

---

## Current state (verified 2026-07-17)

`context/AuthContext.tsx` is **454 lines / 13 functions**, split cleanly down the middle:

| Stays client-side (Firebase **Auth**) | Moves server-side (**Firestore**) |
|---|---|
| `signup`, `signin`, `signupPopup`, `signinPopup`, `logout` | `getUser(uid)`, `getProfileUser(uid)` |
| (+ the `onAuthStateChanged` effect) | `likeAudio(audio)`, `dislikeAudio(audio)` |
| | `getUserCollections(uid)`, `addCollection(collection)` |
| | `likeCollection(col)`, `dislikeCollection(col)` |

**Consumers:** `app/profile/[id]/page.tsx`, `components/forms/addCollection.tsx`, `Header.tsx`, `login.tsx`, `signup.tsx`, `UserAudioList.tsx`, `UserCollectionsList.tsx`, `ListDrawer.tsx`.

**Other facts:** no `firebase.json`/`firestore.rules` exist (rules are console-only). `firebase-admin@14` is currently a **devDependency** (migration script only). The existing API route is `pages/api/searchEngine.ts` (Pages Router); `app/api/` does not exist yet.

---

## Design

### Auth model (unchanged from what already works)

Firebase **Auth stays in the browser** — it's the right place, and it's portable to Flutter. The client attaches its ID token to every API call:

```
Authorization: Bearer <firebase-id-token>
```

The Route Handler verifies it with Admin (`verifyIdToken`) and derives the `uid`.

🎯 **The uid comes from the verified token — never from the request body, query, or path.** This is the rule that makes the whole phase worth doing; a caller must not be able to act as another user. (Phase 2A proved this model out in the Python skeleton before it was reverted — same design, different runtime.)

### Credentials on Vercel — base64, deliberately

A service-account private key contains real newlines, and env vars mangle them. The `.replace(/\\n/g, "\n")` dance is the classic footgun.

**Decision: store the whole service-account JSON base64-encoded** in `FIREBASE_SERVICE_ACCOUNT_B64`, decode + `JSON.parse` at init. One var, no newline handling, no escaping.

Admin must be a **singleton** (`getApps().length ? getApp() : initializeApp(...)`) — serverless re-invokes module scope, and re-initialising throws.

`firebase-admin` moves from **devDependencies → dependencies**.

### API surface (App Router Route Handlers, under `app/api/`)

All require a verified Bearer token.

| Method | Route | Replaces |
|---|---|---|
| `GET` | `/api/me` | `getUser(uid)` |
| `POST` | `/api/me` | `ensureUserDoc` (create-if-missing) |
| `GET` | `/api/users/[uid]` | `getProfileUser(uid)` |
| `PUT` | `/api/me/loved-songs` (body: `{ audio }`) | `likeAudio` |
| `DELETE` | `/api/me/loved-songs/[audioId]` | `dislikeAudio` |
| `GET` | `/api/users/[uid]/collections` | `getUserCollections(uid)` |
| `POST` | `/api/collections` | `addCollection` |
| `PUT` | `/api/me/loved-collections/[id]` | `likeCollection` |
| `DELETE` | `/api/me/loved-collections/[id]` | `dislikeCollection` |

`likeAudio` takes a whole `Audio` object (it's stored in `lovedSongs`), hence a body rather than a path param.

**Semantics from Phase 1 must be preserved exactly**: uid-keyed docs (`users/{uid}`), a **transaction** for `lovedSongs` (object array, ID-deduped), `arrayUnion`/`arrayRemove` for `lovedCollections`, `increment()` for the collection likes counter, and the `{ userData: {...} }` document shape. **No data-model change** — production is already migrated.

### Firestore rules — into the repo, deployed LAST

Add `firebase.json` + `firestore.rules` at the repo root. **Capture the current console rules first** as a baseline and rollback.

Target: deny all direct client access. The Admin SDK bypasses rules entirely, so the server keeps working.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 🚨 Deploy order is the whole risk

**Rules are deployed LAST, and only after the API is live and the web client is using it.**

```
1. Deploy the API routes + FIREBASE_SERVICE_ACCOUNT_B64 to Vercel   (client still on the Web SDK — nothing breaks)
2. Deploy the web client cutover                                      (now reading/writing via the API)
3. Verify in production
4. ONLY THEN: firebase deploy --only firestore:rules                  (instantly reversible)
```

Do it backwards and **every user's data access breaks instantly**. Rules deploy in seconds and revert in seconds, which is why it's last — it's the one step that's trivially undoable.

---

## Non-goals

- **No data-model change.** Prod is uid-keyed and migrated; the `{ userData }` shape stays.
- **No auth change.** Firebase Auth stays client-side; sign-in flows are untouched.
- **`pages/api/searchEngine.ts` stays where it is.** It's public, needs no auth, and works. Migrating it to a Route Handler is churn for no gain (note it as a future tidy).
- **No YouTube engine swap**, no player changes, no design changes (Phase 6), no perf work (Phase 7).
- **No `slice(0.2)` avatar fix, no React Compiler `warn` fixes** — both have their own tasks.
- **No TypeScript 7 / ESLint 10 / react-player 3** — all blocked with verified evidence.

---

## Testing strategy

- **Route Handlers are genuinely unit-testable** — mock `firebase-admin`, assert: 401 on missing/invalid token, **uid is taken from the token and not from the body**, and each handler's Firestore call shape. This is new, real coverage.
- **The auth-boundary tests are the important ones.** Include an explicit "caller cannot act as another user" test (pass a different uid in the body/path, assert it's ignored) — that's the security property, so it should be asserted, not assumed.
- **Existing 41 tests must stay green.** The component tests mock `@/context/AuthContext`, so they'll keep passing through the cutover — **which means they will NOT catch a broken API call.** Say so; don't let green imply safety.
- **Gates + CI** as always. CI can't reach Firebase, so route tests must mock Admin.
- **Manual smoke is mandatory** (owner, against prod-like): sign in → profile loads → liked songs → collections → like/unlike a song → like/unlike a collection → create a collection. Then, **after** rules lockdown, re-run all of it.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Rules locked before the API is live → total outage** | Strict deploy order; rules are the LAST step and revert in seconds |
| **Vercel mangles the private key's newlines** | Base64-encode the whole JSON — one var, no escaping |
| **Admin re-init on every serverless invocation** | Singleton via `getApps()` |
| **A service-account key leaks into git** | It lives only in Vercel env + `.env.local` (gitignored); `.env.example` documents the name only. **Use a fresh key — the Phase 1 one was exposed in a transcript.** |
| **Cutover breaks a data path silently** | Port endpoint-by-endpoint with tests; the component tests won't catch it, so manual smoke decides |
| A caller spoofs another uid | uid derived from the verified token only; asserted by test |
| Existing rules unknown / no rollback | Capture the current console rules into the repo **before** changing anything |
| Cold starts / Admin bundle size on Vercel | Acceptable at ~9 users; Route Handlers are server-only so nothing ships to the browser |

## Success criteria

`apps/web` contains **zero `firebase/firestore` imports** — the browser cannot reach the database. All 8 data operations run server-side behind verified-token Route Handlers, preserving Phase 1's semantics exactly. `firestore.rules` lives in the repo and denies all client access. `AuthContext` shrinks to auth + API calls. All gates + CI green, and the owner has smoke-tested **after** the rules lockdown.
