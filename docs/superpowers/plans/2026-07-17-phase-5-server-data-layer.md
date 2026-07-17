# Phase 5 — Server-Side Data Layer + Firestore Lockdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 8 Firestore operations out of the browser into Next Route Handlers backed by Firebase Admin (uid from the verified token only), bring `firestore.rules` into the repo, and lock out direct client access — **all in this one phase**.

**Architecture:** Build the server foundation (Admin singleton + token verification), then all 9 endpoints with tests, then a frontend API client, then cut `AuthContext` over to it, then add the rules file. The **code all lands together**; only the *production deploy* is staged (rules last) — that's a runtime safety constraint, documented at the end, not a reason to split the work.

**Tech Stack:** Next 16 App Router, React 19, TypeScript 5.9.3, Firebase 12 (Web SDK, auth only) + firebase-admin 14 (server), Vitest 4, Vercel, `apps/web` in an npm-workspaces monorepo.

**Working branch:** `v2_2026` — commit directly to it.

**Context for the engineer:**
- Gates from the **repo root**: `npm run lint && npm run typecheck && npm test && npm run build`
- **41 tests** must stay passing; this phase ADDS route-handler tests. A dropping count is a FAILURE.
- ⚠️ **Do NOT run `format:check` locally** (Windows CRLF false-positives). Run `npx prettier --write` on files you touch. CI is the real gate.
- ⚠️ **NEVER `git add -A`** — 19 untracked owner fonts in `apps/web/public/fonts/{offbit,satoshi}/` must NOT be committed. Stage explicit paths; check `git status --short` first.
- `npm install` from the **ROOT** with `--workspace apps/web`. Verify no nested duplicates on disk after installing.
- Real `.env` at `apps/web/.env` (7 `NEXT_PUBLIC_*` values) so `npm run build` works.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

**🚫 HARD RULES**
- **Do NOT change the Firestore data model.** Prod is uid-keyed and migrated. Doc shape stays `{ userData: {...} }` for users and `{ collectionData: {...} }` for collections.
- **Preserve Phase 1 semantics EXACTLY**: uid-keyed `users/{uid}`; a **transaction** for `lovedSongs` (object array, ID-deduped); `arrayUnion`/`arrayRemove` for `lovedCollections`; `increment()` for the collection likes counter.
- **uid comes from the verified token ONLY** — never from the request body, query, or path. This is the security property of the whole phase.
- **Firebase Auth stays in the browser.** Do NOT move signup/signin/logout server-side.
- **Do NOT commit any service-account key.** It lives in Vercel env + a gitignored `.env.local`.
- **Do NOT touch** `typescript`/`eslint`/`react-player` (all blocked), the player, `pages/api/searchEngine.ts`, the `slice(0.2)` bug, or the React Compiler `warn` findings.
- **Do NOT delete or weaken a test.**

**The 8 operations moving server-side** (current `context/AuthContext.tsx`):
`getUser(uid)`, `getProfileUser(uid)`, `likeAudio(audio)`, `dislikeAudio(audio)`, `getUserCollections(uid)`, `addCollection(collection)`, `likeCollection(col)`, `dislikeCollection(col)`. Auth functions (`signup`, `signin`, `signupPopup`, `signinPopup`, `logout`) STAY.

---

## Task 1: Firebase Admin singleton + token verification (TDD where pure)

**Files:** create `apps/web/lib/firebase/admin.ts`, `apps/web/lib/firebase/verify.ts`, `apps/web/lib/firebase/verify.test.ts`; modify `apps/web/package.json` (move `firebase-admin` to dependencies), `apps/web/.env.example`.

- [ ] **Step 1: Make `firebase-admin` a runtime dependency**

It's currently a devDependency (migration script). Move it:
```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install firebase-admin@14 --save --workspace apps/web
```
Confirm it's now under `"dependencies"` in `apps/web/package.json`, removed from `"devDependencies"`. Verify single instance on disk.

- [ ] **Step 2: Admin singleton — `apps/web/lib/firebase/admin.ts`**

```ts
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * The whole service-account JSON, base64-encoded, in one env var. Base64
 * avoids the private-key newline mangling that plagues env-var secrets on
 * Vercel. Set FIREBASE_SERVICE_ACCOUNT_B64 in Vercel and in .env.local.
 */
function loadCredential() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  }
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return cert(json);
}

// Serverless re-invokes module scope; initializing twice throws.
function adminApp(): App {
  return getApps().length ? getApp() : initializeApp({ credential: loadCredential() });
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
```

- [ ] **Step 3: Write the failing test** — `apps/web/lib/firebase/verify.test.ts`

The uid-from-token rule is the security property, so it gets a real test.
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({}),
}));

import { uidFromRequest } from "@/lib/firebase/verify";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost/api/me", { headers });

describe("uidFromRequest", () => {
  beforeEach(() => verifyIdToken.mockReset());

  it("returns null when the Authorization header is missing", async () => {
    expect(await uidFromRequest(req({}))).toBeNull();
  });

  it("returns null when the scheme is not Bearer", async () => {
    expect(await uidFromRequest(req({ Authorization: "Basic abc" }))).toBeNull();
  });

  it("returns null when verification throws", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    expect(
      await uidFromRequest(req({ Authorization: "Bearer nope" }))
    ).toBeNull();
  });

  it("returns the uid from a verified token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-123" });
    expect(
      await uidFromRequest(req({ Authorization: "Bearer good" }))
    ).toBe("uid-123");
  });
});
```

- [ ] **Step 4: Implement `apps/web/lib/firebase/verify.ts`**

```ts
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Resolve the caller's uid from a verified Firebase ID token. The uid comes
 * from the token only — never from the request body, query, or path — so a
 * caller cannot act as another user. Returns null on any failure.
 */
export async function uidFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.uid ?? null;
  } catch {
    return null;
  }
}

/** Standard 401 body. */
export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- lib/firebase/verify.test.ts
```
Expected: 4 pass.

- [ ] **Step 6: Document the env var** — append to `apps/web/.env.example`:

```bash
# Server only (Route Handlers). Base64 of the Firebase service-account JSON.
# Generate: Firebase console -> Project settings -> Service accounts -> Generate
# new private key, then: base64 -w0 serviceAccount.json
# NEVER commit the key or this value. Set it in Vercel + .env.local.
FIREBASE_SERVICE_ACCOUNT_B64=
```

- [ ] **Step 7: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
NOTE: `npm run build` does NOT need `FIREBASE_SERVICE_ACCOUNT_B64` — `loadCredential()` only runs when a handler is invoked, not at build time. Confirm the build passes without it. If the build tries to init Admin at module scope, that's a bug — the singleton must be lazy (it is, above).
```bash
git status --short
git add apps/web/lib/firebase/ apps/web/package.json package-lock.json apps/web/.env.example
git commit -m "feat(api): Firebase Admin singleton + token verification

Lazy base64-credentialled Admin app (dodges Vercel's private-key newline
footgun) and uidFromRequest, which derives uid from the verified ID token
only. firebase-admin promoted to a runtime dependency.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: The 9 Route Handlers

**Files:** create under `apps/web/app/api/` — see table. Plus a shared serializer `apps/web/lib/api/shape.ts`, and `apps/web/app/api/me/route.test.ts`.

The Admin SDK's Firestore API differs slightly from the Web SDK: `db.collection("users").doc(uid).get()`, `snap.exists` (property, not method), `snap.data()`, `ref.set()/update()`, `db.runTransaction()`, `FieldValue.arrayUnion/arrayRemove/increment`. Import `FieldValue` from `firebase-admin/firestore`.

**Every handler:** `const uid = await uidFromRequest(req); if (!uid) return unauthorized();` first. `export const runtime = "nodejs";` (firebase-admin needs Node, not Edge).

- [ ] **Step 1: Shared serializer** — `apps/web/lib/api/shape.ts`

Extract the exact object-shaping that lives in the current `getUser`/`getProfileUser`/`getUserCollections` so client and server agree.
```ts
import type { User, Collection } from "@/constants/interfaces";

export function shapeUser(uid: string, d: any): User {
  return {
    ID: d.ID,
    docID: uid,
    avatar: d.avatar,
    userName: d.userName,
    email: d.email,
    marketingEmails: d.marketingEmails,
    lovedSongs: [...(d.lovedSongs ?? [])],
    collections: [...(d.collections ?? [])],
    lovedCollections: [...(d.lovedCollections ?? [])],
    followers: [...(d.followers ?? [])],
    following: [...(d.following ?? [])],
  };
}

export function shapeCollection(id: string, c: any): Collection {
  return {
    ID: id,
    title: c.title,
    desc: c.desc,
    thumbnails: [...c.thumbnails],
    owner: {
      ID: c.owner.ID,
      docID: c.owner.docID,
      name: c.owner.name,
      avatar: c.owner.profilePic,
    },
    audio: [...c.audio],
    likes: c.likes,
    tags: [...c.tags],
    date: c.date,
    private: c.private,
    collectionLengthSec: c.collectionLengthSec,
  };
}
```
NOTE: the current `getUserCollections` reads `owner.profilePic` into `owner.avatar` — that quirk is preserved verbatim (do not "fix" it; it's existing behaviour).

- [ ] **Step 2: `GET`/`POST` `/api/me`** — `apps/web/app/api/me/route.ts`

```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { shapeUser } from "@/lib/api/shape";

export const runtime = "nodejs";

// getUser(uid)
export async function GET(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) return Response.json(null, { status: 404 });
  return Response.json(shapeUser(uid, snap.data()!.userData));
}

// ensureUserDoc — create-if-missing. Body: the userData fields for a new user.
export async function POST(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const ref = adminDb().collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) return Response.json(shapeUser(uid, snap.data()!.userData));
  const body = await req.json();
  // uid is forced from the token — never trust body.ID
  const userData = { ...body, ID: uid };
  await ref.set({ userData });
  return Response.json(shapeUser(uid, userData), { status: 201 });
}
```

- [ ] **Step 3: `GET` `/api/users/[uid]`** — `apps/web/app/api/users/[uid]/route.ts`

Public-ish profile read (still requires a valid token, but returns ANY user's public profile by path uid). This is the one place a path uid is legitimate — it's a *read of a public profile*, not an action on the caller's own data.
```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { shapeUser } from "@/lib/api/shape";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const caller = await uidFromRequest(req);
  if (!caller) return unauthorized();
  const { uid } = await params;
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) return Response.json({}, { status: 404 });
  return Response.json(shapeUser(uid, snap.data()!.userData));
}
```
NOTE Next 16: `params` is a Promise — await it (same pattern as `app/profile/[id]/page.tsx`).

- [ ] **Step 4: `PUT`/`DELETE` loved-songs**

`apps/web/app/api/me/loved-songs/route.ts` — `PUT` (likeAudio; body `{ audio }`), transaction, ID-dedup, preserving Phase 1 exactly:
```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Audio } from "@/constants/interfaces";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { audio } = (await req.json()) as { audio: Audio };
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current: Audio[] = snap.data()!.userData?.lovedSongs ?? [];
    if (current.some((s) => s.ID === audio.ID)) return; // already loved
    tx.update(ref, { "userData.lovedSongs": [...current, audio] });
  });
  return Response.json({ ok: true });
}
```

`apps/web/app/api/me/loved-songs/[audioId]/route.ts` — `DELETE` (dislikeAudio), transaction filter:
```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Audio } from "@/constants/interfaces";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ audioId: string }> }
) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { audioId } = await params;
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current: Audio[] = snap.data()!.userData?.lovedSongs ?? [];
    tx.update(ref, {
      "userData.lovedSongs": current.filter((s) => s.ID !== audioId),
    });
  });
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: `GET` `/api/users/[uid]/collections`** — `apps/web/app/api/users/[uid]/collections/route.ts`

```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { shapeCollection } from "@/lib/api/shape";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const caller = await uidFromRequest(req);
  if (!caller) return unauthorized();
  const { uid } = await params;
  const q = await adminDb()
    .collection("collections")
    .where("collectionData.owner.ID", "==", uid)
    .get();
  return Response.json(q.docs.map((d) => shapeCollection(d.id, d.data().collectionData)));
}
```

- [ ] **Step 6: `POST` `/api/collections`** — `apps/web/app/api/collections/route.ts`

addCollection. **Owner is built from the token uid + the caller's own user doc, NOT from the body** — the client used to pass its own `user` object; the server must not trust that.
```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection } from "@/constants/interfaces";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return unauthorized();
  const u = userSnap.data()!.userData;
  const input = (await req.json()) as Collection;
  if (!input.title) return Response.json({ error: "Title required" }, { status: 400 });

  const collectionData = {
    title: input.title,
    desc: input.desc,
    thumbnails: [...input.thumbnails],
    owner: { ID: uid, docID: uid, name: u.userName, avatar: u.avatar },
    audio: [...input.audio],
    likes: 0,
    tags: [...input.tags],
    date: input.date,
    private: input.private,
    collectionLengthSec: input.collectionLengthSec,
  };
  const ref = await db.collection("collections").add({ collectionData });
  return Response.json({ id: ref.id }, { status: 201 });
}
```

- [ ] **Step 7: `PUT`/`DELETE` loved-collections** — `apps/web/app/api/me/loved-collections/[id]/route.ts`

Both the user's `lovedCollections` (arrayUnion/arrayRemove) AND the collection's `likes` (increment) — exactly as Phase 1.
```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { id } = await params;
  const db = adminDb();
  await db.collection("users").doc(uid).update({
    "userData.lovedCollections": FieldValue.arrayUnion(id),
  });
  await db.collection("collections").doc(id).update({
    "collectionData.likes": FieldValue.increment(1),
  });
  return Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { id } = await params;
  const db = adminDb();
  await db.collection("users").doc(uid).update({
    "userData.lovedCollections": FieldValue.arrayRemove(id),
  });
  await db.collection("collections").doc(id).update({
    "collectionData.likes": FieldValue.increment(-1),
  });
  return Response.json({ ok: true });
}
```

- [ ] **Step 8: The auth-boundary test** — `apps/web/app/api/me/route.test.ts`

The security property must be asserted, not assumed. Mock admin + verify:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdToken = vi.fn();
const userGet = vi.fn();
const userSet = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({
    collection: () => ({ doc: () => ({ get: userGet, set: userSet }) }),
  }),
}));

import { GET, POST } from "@/app/api/me/route";

const req = (headers: Record<string, string>, body?: unknown) =>
  new Request("http://localhost/api/me", {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

describe("/api/me", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    userGet.mockReset();
    userSet.mockReset();
  });

  it("401 without a token", async () => {
    const res = await GET(req({}));
    expect(res.status).toBe(401);
  });

  it("returns the caller's user on GET", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ userData: { ID: "uid-1", userName: "n" } }),
    });
    const res = await GET(req({ Authorization: "Bearer x" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ID).toBe("uid-1");
  });

  it("POST forces uid from the token, ignoring body.ID (spoof attempt)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-real" });
    userGet.mockResolvedValue({ exists: false });
    userSet.mockResolvedValue(undefined);
    const res = await POST(
      req({ Authorization: "Bearer x" }, { ID: "uid-VICTIM", userName: "n" })
    );
    // The doc written must be keyed/stamped with uid-real, not uid-VICTIM
    const written = userSet.mock.calls[0][0];
    expect(written.userData.ID).toBe("uid-real");
    expect((await res.json()).ID).toBe("uid-real");
  });
});
```

- [ ] **Step 9: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: green; test count = 41 + new (verify: 4, me: 3). Report the new total.
```bash
cd apps/web && npx prettier --write app/api lib/api
cd D:\Dev\YukiRythem\Yukirhythm
git status --short
git add apps/web/app/api apps/web/lib/api
git commit -m "feat(api): Route Handlers for all 8 Firestore operations

uid from the verified token only; Phase 1 semantics preserved (transaction
for lovedSongs, arrayUnion/arrayRemove + increment for collections). Auth
boundary asserted by test: a spoofed body.ID is ignored.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Frontend API client

**Files:** create `apps/web/lib/api/client.ts`.

A thin wrapper that attaches the current user's Firebase ID token to every call. `auth` is exported from `config/firebase.ts`.

- [ ] **Step 1: `apps/web/lib/api/client.ts`**

```ts
import { auth } from "@/config/firebase";
import type { Audio, Collection, User } from "@/constants/interfaces";

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  return res;
}

export const api = {
  getMe: async (): Promise<User | null> => {
    const res = await authedFetch("/api/me");
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load user");
    return res.json();
  },
  ensureMe: async (userData: Record<string, unknown>): Promise<User> => {
    const res = await authedFetch("/api/me", {
      method: "POST",
      body: JSON.stringify(userData),
    });
    if (!res.ok) throw new Error("Failed to create user");
    return res.json();
  },
  getProfile: async (uid: string): Promise<User | Record<string, never>> => {
    const res = await authedFetch(`/api/users/${uid}`);
    if (!res.ok) return {};
    return res.json();
  },
  getUserCollections: async (uid: string): Promise<Collection[]> => {
    const res = await authedFetch(`/api/users/${uid}/collections`);
    if (!res.ok) throw new Error("Failed to load collections");
    return res.json();
  },
  likeAudio: (audio: Audio) =>
    authedFetch("/api/me/loved-songs", {
      method: "PUT",
      body: JSON.stringify({ audio }),
    }),
  dislikeAudio: (audioId: string) =>
    authedFetch(`/api/me/loved-songs/${audioId}`, { method: "DELETE" }),
  addCollection: (collection: Collection) =>
    authedFetch("/api/collections", {
      method: "POST",
      body: JSON.stringify(collection),
    }),
  likeCollection: (id: string) =>
    authedFetch(`/api/me/loved-collections/${id}`, { method: "PUT" }),
  dislikeCollection: (id: string) =>
    authedFetch(`/api/me/loved-collections/${id}`, { method: "DELETE" }),
};
```

- [ ] **Step 2: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
cd apps/web && npx prettier --write lib/api/client.ts
cd D:\Dev\YukiRythem\Yukirhythm
git add apps/web/lib/api/client.ts
git commit -m "feat(api): frontend client that attaches the Firebase ID token

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Cut `AuthContext` over to the API

**Files:** `apps/web/context/AuthContext.tsx` (+ `components/forms/addCollection.tsx` and any consumer whose call signature changes).

Replace the 8 Firestore functions with `api.*` calls. **Keep the exact same function names, signatures, and provider value** so consumers don't change — except where a signature genuinely must (noted below).

- [ ] **Step 1: Remove all `firebase/firestore` imports** from `AuthContext.tsx`

After this task, `grep "firebase/firestore" apps/web/context/AuthContext.tsx` returns nothing. Keep `firebase/auth` imports.

- [ ] **Step 2: Rewrite the 8 functions** to call `api` (from `@/lib/api/client`). Behaviour must be identical:
  - `getUser(uid)` → `const u = await api.getMe(); if (u) setUser(u);` (getMe uses the token's uid; the `uid` arg is now only used to decide whether to fetch — keep the signature, ignore drift). If `getUser` is called for the CURRENT user only (it is — always `getUser(user.ID)`), `api.getMe()` is correct.
  - `getProfileUser(uid)` → `return api.getProfile(uid);`
  - `likeAudio(audio)` → `await api.likeAudio(audio); await getUser(user.ID);`
  - `dislikeAudio(audio)` → `await api.dislikeAudio(audio.ID); await getUser(user.ID);`
  - `getUserCollections(uid)` → `return api.getUserCollections(uid);`
  - `addCollection(col)` → `await api.addCollection(col); router.push(\`/collections/${user.ID}\`);`
  - `likeCollection(col)` → `await api.likeCollection(col.ID); await getUser(user.ID);`
  - `dislikeCollection(col)` → `await api.dislikeCollection(col.ID); await getUser(user.ID);`
  Preserve the `if (!user.ID) return` / `if (user.ID)` guards and the error-toast behaviour.

- [ ] **Step 3: Wire account creation to `ensureMe`**

`signup`/`signupPopup`/`signinPopup` currently call the local `ensureUserDoc` helper against Firestore directly. Replace those writes with `await api.ensureMe(userData)` (the POST /api/me create-if-missing). The `lib/user/ensureUserDoc.ts` helper + its test may become unused — if so, delete them and note it; if still referenced, leave them.

- [ ] **Step 4: Verify the boundary**

```bash
cd apps/web
grep -rn "firebase/firestore" context/ components/ app/ sections/ lib/ | grep -v node_modules
```
Expected: **nothing** (the only remaining `firebase/*` imports are `firebase/auth` and `firebase/app` in `config/firebase.ts`, and `firebase-admin/*` in `lib/firebase/` + `scripts/`).
The 4A smoke tests mock `@/context/AuthContext`, so they'll still pass — note that this does NOT prove the API calls work; that's the manual smoke.

- [ ] **Step 5: Gate + commit**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint && npm run typecheck && npm test && npm run build
git status --short
git add apps/web/context/AuthContext.tsx <plus any consumer/helper you changed or deleted>
git commit -m "refactor(auth): route all Firestore access through the API

AuthContext no longer imports firebase/firestore; the 8 data operations now
call the token-authed Route Handlers. Firebase Auth stays client-side. No
data-model change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Firestore rules in the repo

**Files:** create `firebase.json`, `firestore.rules`, `.firestorerc`/`.firebaserc` at the **repo root**; `.gitignore` for admin key.

- [ ] **Step 1: FIRST capture the current console rules as a baseline/rollback**

If you have `firebase` CLI access, run `firebase firestore:rules get` (or the owner pastes the current rules). If unavailable, note that the owner must record the current console rules before deploying the new ones. **Save whatever the current rules are** into the commit message or a comment, so there's a rollback.

- [ ] **Step 2: `firestore.rules`** (repo root)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All client access is denied. Data flows exclusively through the
    // server (Firebase Admin in Next Route Handlers), which bypasses rules.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: `firebase.json`** (repo root)

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 4: `.firebaserc`** (repo root) — pins the project

```json
{
  "projects": {
    "default": "yukirythem-a38dd"
  }
}
```

- [ ] **Step 5: gitignore the admin key + local env**

Ensure the repo root `.gitignore` covers a service-account key path — add if missing:
```
# Firebase Admin service-account keys — never commit
*serviceAccount*.json
*firebase-adminsdk*.json
```
(`.env`/`.env*.local` are already ignored.)

- [ ] **Step 6: Do NOT deploy the rules here.** This task only versions them. Deploy is owner-run, LAST (see the deploy runbook below).

- [ ] **Step 7: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git status --short
git add firebase.json firestore.rules .firebaserc .gitignore
git commit -m "chore(security): version Firestore rules that deny direct client access

Rules now live in the repo. NOT yet deployed -- deploy is the last step of
the production rollout, after the API is live and the client is cut over.
Previous console rules recorded for rollback: <paste or note>.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Push and prove CI green

- [ ] **Step 1: Full gate + push**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git status --short   # fonts must NOT be staged
git push origin v2_2026
```

- [ ] **Step 2: Confirm CI green**

```bash
gh run list --branch v2_2026 --limit 1
```
Poll until complete, then `gh run view <run-id>`. CI runs `format:check` (local can't). **CI green is the definition of done** for the code.

- [ ] **Step 3: Report**

Files created, final test count, confirmation `apps/web` has zero `firebase/firestore` imports, and the CI run URL.

---

## 🚨 Production deploy runbook (OWNER-RUN — the one thing that stays staged)

**This is not a code task. It is the deploy order, and getting it wrong is a live outage.** Claude does not run this — the owner does, with Claude available to interpret output.

1. **Revoke the old service-account key** (the Phase 1 one, exposed in a transcript) and **generate a FRESH one**. Firebase console → Project settings → Service accounts.
2. `base64 -w0 serviceAccount.json` → set **`FIREBASE_SERVICE_ACCOUNT_B64`** in Vercel (Production env) and in local `.env.local`.
3. **Deploy the API + client to Vercel.** At this point the browser is talking to the new API, but **the old permissive rules are still live** — so even if something's wrong, nothing is locked out yet.
4. **Verify in production**: sign in → profile → liked songs → collections → like/unlike a song → like/unlike a collection → create a collection. All via the API now.
5. **ONLY AFTER 4 passes:** `firebase deploy --only firestore:rules`. This denies direct client access. It applies in seconds and **reverts in seconds** (`firebase deploy` with the old rules) if anything breaks — which is exactly why it's last.
6. **Re-run the step-4 smoke** with rules locked. If any data op fails now, an endpoint is still reading/writing client-side — roll the rules back and fix.

**If you deploy the rules first, every user's data access breaks instantly.** Rules last, always.

---

## Definition of Done

- [ ] `apps/web` has **zero `firebase/firestore` imports** (verified by grep).
- [ ] All 8 data operations run through token-authed Route Handlers; uid is from the token only (asserted by test).
- [ ] Phase 1 semantics preserved: transaction for lovedSongs, arrayUnion/arrayRemove + increment for collections, `{ userData }` shape, uid-keyed docs.
- [ ] `firebase-admin` is a runtime dependency; Admin is a lazy base64-credentialled singleton.
- [ ] `firestore.rules` + `firebase.json` in the repo, denying client access — **not yet deployed**.
- [ ] New route-handler tests pass; existing 41 still green; none deleted/weakened.
- [ ] **CI green on `v2_2026`.**
- [ ] The owner deploy runbook is documented; no key committed.

## Owner smoke test (mandatory — the automated tests mock everything server-side)

Do this against a **preview/prod deploy with the credential set** (Route Handlers can't run in the Vitest/jsdom env): sign in → profile loads → liked songs → collections → like/unlike a song → like/unlike a collection → create a collection → **then run the deploy runbook and re-verify with rules locked.**

## Self-review notes (author)

- **Whole phase, one plan** — foundation, all 9 endpoints, client, cutover, rules — as requested. Only the *production deploy* is staged, and that's a runtime safety constraint (rules-last), not code separation.
- **The security property is a real test, not a claim**: `/api/me` POST asserts a spoofed `body.ID` is overridden by the token uid.
- **Honest about test blindness**: Route Handlers can't run under Vitest/jsdom, and the component tests mock `AuthContext` — so the automated suite proves shape/auth-logic, not live data flow. The manual smoke + the staged deploy are the real gates, stated plainly.
- **Phase 1 semantics are transcribed exactly** from the current `AuthContext` (transaction dedupe, arrayUnion/increment, the `owner.profilePic`→`avatar` quirk) — this is a move, not a rewrite.
- **Deploy order is the headline risk** and is isolated into an owner runbook with a seconds-to-revert rules step last.
