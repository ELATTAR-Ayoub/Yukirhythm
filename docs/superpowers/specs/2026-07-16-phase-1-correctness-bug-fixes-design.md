# Phase 1 — Correctness & Bug Fixes (Design)

**Date:** 2026-07-16
**Project:** Yukirhythm (Next.js 14 App Router music/podcast player)
**Program:** Full rebuild-grade modernization — phase 2 of 6 (Phase 0 shipped)
**Risk:** 🟡 Low–Medium — fixes real behavior; one careful live-data migration (owner-run, backed up)

---

## Context

Phase 0 delivered the safety net (lint/format/typecheck/test/CI). Phase 1 fixes the actual user-facing bugs on the **stable current stack** (no dependency upgrades — those are Phase 3). Every pure-logic fix gets a Vitest unit test so the net keeps growing.

**Decisions locked in with the owner:**
- **User identity:** adopt the Firebase-native model — the Firestore user document is keyed by the **Auth `uid`** (`doc(users, uid)`). One ID everywhere; duplicates become structurally impossible. Includes a **one-time migration** of existing random-ID user docs, run by the owner, **backup-first + dry-run + idempotent**.
- **YouTube:** keep scraping, harden it (cache, timeout, graceful errors).
- Keep the current visual design (polish only; the design refresh is Phase 4).

**Deferred (unchanged):** full Redux untangle + Firebase service-layer extraction (Phase 2), dependency major upgrades (Phase 3), design refresh (Phase 4), the `localStorage`-during-SSR issue (Phase 2), collections data-model cleanup (Phase 2).

---

## The user-identity problem (root cause)

Today one user is tracked by **three** identifiers:

| Identifier | Source | Issue |
|---|---|---|
| `uid` | Firebase Auth (globally unique, guaranteed) | The correct one |
| `docID` | Random ID from `addDoc()` | Pointless extra ID |
| `userData.ID` | A copy of `uid` stored as a field | Redundant |

Reads query `where("userData.ID","==",uid)`; writes use `docID`. Worse, OAuth sign-in always `addDoc`s a **new** doc (the dedup guard is commented out), so every OAuth login can mint a duplicate account.

### Target model
- User doc address **is** the `uid`: `doc(firestore, "users", uid)`.
- Document body keeps its current nested shape `{ userData: { ID, avatar, userName, ... } }` (we are **not** reshaping fields in Phase 1 — only changing the doc's address). `userData.ID` stays equal to `uid` for compatibility.
- Reads become direct `getDoc(doc(users, uid))` (no query). `user.docID` is set to `uid`, so existing call sites that use `user.docID` (e.g. `likeAudio`) keep working unchanged.
- New account creation uses `setDoc(doc(users, uid), …)` → a second write for the same user updates, never duplicates.

---

## Work items

### A. Auth: eliminate duplicate accounts (uid-keyed model)

**Files:** `context/AuthContext.tsx` (+ a small extracted helper).

1. **Extract `ensureUserDoc(uid, userData)`** — one function used by every account-creation path:
   `getDoc(doc(users, uid))` → if it exists, return existing data (no write); else `setDoc(doc(users, uid), { userData })`. Structurally prevents duplicates.
2. **`signup` (email/password):** replace `addDoc(...)` with `ensureUserDoc(user.uid, …)`.
3. **`signupPopup` / `signinPopup` (OAuth):** route through `ensureUserDoc`; remove the commented-out dead dedup block; **fix the shadowed `const auth = getAuth()`** inside `signupPopup` (use the imported, app-bound `auth`).
4. **`getUser` / `getProfileUser`:** replace the `query(where("userData.ID","==",uid))` + `getDocs` with a direct `getDoc(doc(users, uid))`; set `docID = uid`.
5. Remove now-dead query/`where` imports if unused.

**Data-shape note:** collections (`collections` collection) are unchanged in Phase 1 — they are looked up by `collectionData.owner.ID` and are not part of the duplicate-user bug. Their cleanup is Phase 2.

### B. Firestore writes: atomic & race-free

**Files:** `context/AuthContext.tsx`.

- **`lovedCollections`** (array of string IDs) → `updateDoc(ref, { "userData.lovedCollections": arrayUnion(col.ID) })` / `arrayRemove(col.ID)`.
- **Collection `likes` counter** → `updateDoc(colRef, { "collectionData.likes": increment(1) })` / `increment(-1)`. **Fixes the in-place `col.likes = col.likes + 1` mutation bug** and the read-modify-write race.
- **`lovedSongs`** (array of `Audio` objects, deduped by `ID`) → a **Firestore transaction** (`runTransaction`: read doc → compute new array with ID-dedup → set) so concurrent likes can't clobber each other. Preserves the existing "don't add if ID already loved" semantics.
- All handlers surface errors to the UI via a toast instead of only `console.log`.

### C. Player correctness

**Files:** `store/AudioConfig.ts`, `components/player/controls.tsx`, and the add-to-player call sites (`sections/Hero.tsx`, `components/player/UserAudioList.tsx`, `components/player/UserCollectionsList.tsx`).

1. **No duplicate songs (toDo #8):**
   - `ADD_ITEM` reducer skips the payload if an audio with the same `ID` is already in `audioState`.
   - `setAudioConfig` dedupes by `ID` when given an array (multi-select).
   - Unit-tested (pure reducer logic).
2. **Real loading state (toDo #5):**
   - Replace `dispatch(SET_LOADING(!AudioLoading))` (a toggle) with explicit transitions: `onBuffer → SET_LOADING(true)`, `onBufferEnd → SET_LOADING(false)`, `onReady → SET_LOADING(false)`.
   - Show a spinner on the play button while `audioLoading` is true.
3. **Play-failure handling (toDo #11):**
   - ReactPlayer `onError` → toast ("This video can't be played here — skipping") and auto-advance to the next track.
4. **"Added to player" feedback (toDo #10):**
   - Toast "Added to player" on successful add; "Already in your player" when a duplicate is skipped.

### D. Harden the YouTube search layer

**Files:** `pages/api/searchEngine.ts`, `sections/Hero.tsx`.

- **API route:**
  - Convert `const { search } = require(...)` → ES `import`.
  - **Input validation:** empty/oversized `string` → `400`.
  - **Timeout:** wrap the scrape in a timeout (e.g. 10s) → `504` on timeout so the client never hangs.
  - **Short-TTL in-memory cache** keyed by `string+quantity` (e.g. 5 min) to cut repeat scrapes and smooth over transient failures.
  - **Correct status codes:** no results → `404`; upstream/scrape failure → `502`. Typed response `Audio[] | { message: string }`.
- **Client (`Hero.tsx`):**
  - Check `res.ok` before treating the payload as results; never render an error object as a list. On failure show a toast.
  - **Show durations in results (toDo #7):** render `secondsToHMS(audioLengthSec)` (helper already exists) in each result row if not already shown.

### E. Metadata fix

**Files:** delete `app/head.tsx`; update `app/layout.tsx`.

- `app/head.tsx` uses the `head.tsx` convention **removed in the Next 14 App Router**, so the title/description may not apply. Move them to the App Router **Metadata API** (`export const metadata: Metadata = {...}`) in `app/layout.tsx`.

### F. Migration script (owner-run, one-time)

**Files:** `scripts/migrate-users-to-uid.ts` (new, outside the app bundle); `firebase-admin` devDep; `.env.example` note for the admin credentials path.

- **Purpose:** move each existing user doc from its random ID to `doc(users, <uid>)` where `uid = userData.ID`.
- **Tooling:** Firebase **Admin SDK** (`firebase-admin`) with a service-account key supplied via an env var / local file that is **git-ignored** (never committed).
- **Safety:**
  - **Backup-first:** the script prints a required-reading banner instructing the owner to export Firestore first (Firebase console → export, or `gcloud firestore export`), and refuses to run "apply" without an explicit `--apply` flag.
  - **Dry-run by default:** lists every doc it would migrate, flags duplicate `uid`s, and reports counts — no writes.
  - **Idempotent:** skips docs already keyed by `uid` (`doc.id === userData.ID`). Safe to re-run.
  - **Duplicate handling:** if two random-ID docs share a `uid`, keep the most complete/recent (most non-empty fields, newest), report the discarded one; do not silently drop data.
  - **Per-doc:** `set(doc(users, uid), body)` then `delete(oldRef)`; batched with error isolation so one bad doc doesn't abort the run.
- **Not part of CI or the app**; it's a manual operational tool with a documented run procedure in the plan.

---

## New / changed files (summary)

| File | Change |
|------|--------|
| `context/AuthContext.tsx` | uid-keyed reads/writes, `ensureUserDoc`, atomic like/collection writes, error toasts, fix shadowed `getAuth` |
| `store/AudioConfig.ts` | `ADD_ITEM`/`setAudioConfig` dedupe by ID |
| `components/player/controls.tsx` | real loading transitions, `onError` handling, spinner |
| `sections/Hero.tsx` | robust search error handling, durations in results, add-to-player toast |
| `components/player/UserAudioList.tsx`, `UserCollectionsList.tsx` | dedupe-aware add + toast |
| `pages/api/searchEngine.ts` | import, validation, timeout, cache, status codes, types |
| `app/layout.tsx` | Metadata API |
| `app/head.tsx` | deleted |
| `scripts/migrate-users-to-uid.ts` | new owner-run migration |
| `lib/` test files | unit tests for dedupe, duration format, search-layer validation/cache |

---

## Testing strategy

- **Unit (Vitest):** `ADD_ITEM`/`setAudioConfig` dedupe reducers; `secondsToHMS`; search-route input validation + cache key + status-code mapping (extract pure helpers so they're testable without hitting YouTube); `ensureUserDoc` logic with a mocked Firestore. Aim: each bug fix has a test that would fail on the old behavior.
- **Gates:** `npm run lint/typecheck/test/build` stay green; CI enforces.
- **Manual smoke (owner, with real `.env`):** search → results show durations; add a song twice → only one, with the right toast; loading spinner appears on buffering; an unplayable video toasts + skips; sign in via Google twice → still one account; like/unlike a song and a collection → persists, counter correct.
- **Migration:** run dry-run against a **backup/staging** first; verify report; then `--apply`.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Migration corrupts/loses live user data | Backup-first (enforced), dry-run default, idempotent, duplicate-keep-most-complete, owner runs it, per-doc error isolation |
| uid-keyed reads break existing call sites using `user.docID` | Set `docID = uid` so those sites keep working; verify each read path |
| `arrayRemove`/transaction subtlety on object arrays (`lovedSongs`) | Use a transaction with explicit ID-based dedupe rather than `arrayRemove` on objects |
| Search cache serves stale/empty results | Short TTL; never cache error responses; cache only successful non-empty results |
| Scope creep into Phase 2 architecture | Keep the doc **shape** unchanged (only the address changes); no Redux restructure this phase |

## Success criteria

All gates green; each listed bug has a failing-before/passing-after test where logic is pure; a Google user signing in twice yields exactly one account (new behavior); the migration script runs dry-run cleanly and its apply path is documented; no dependency majors changed; no design changes.
