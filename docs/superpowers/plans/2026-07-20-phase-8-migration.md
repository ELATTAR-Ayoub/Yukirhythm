# Phase 8 — Migration Implementation Plan

**Goal:** Make the design-system screens the real application — running on the phase 1–7 backend
instead of `MockStudioProvider`, with real auth, then remove the legacy landing app and mock data.

**Spec:** roadmap phase 8. This is the phase the whole program pays off.

**Character.** Unlike 0–7 this is frontend + integration, much of it destructive, and it needs the
browser to verify (dev server against the emulator, then production). It is decomposed into
increments that each leave the app buildable and green, riskiest/destructive steps last.

---

## Increment 1 — Adapter layer (safe, pure, no browser)

The screens render `MockTrack`/`MockCollection`/`MockUser` shapes. The backend returns
`Track`/`Collection`/`User`. Build `lib/studio/adapt.ts`: pure `toStudioTrack(Track)`,
`toStudioCollection(Collection, { pinned })`, `toStudioUser(User)`, mapping field-for-field
(artists[] → "a, b", tracks[] → trackIds[], contentType → kind, counts → followers/following,
displayName → userName + initials). Unit-test every mapping. This is the bridge everything else
uses; it changes nothing that runs yet.

## Increment 2 — Real auth + token-bound client

`lib/studio/auth.ts`: Firebase client sign-in (Google/Facebook popup; connect to the Auth
emulator when `NEXT_PUBLIC_USE_EMULATOR`), `onAuthStateChanged`, and a `TokenProvider` bound to
`auth.currentUser.getIdToken()`. A `useBackend()` hook returns `createBackendClient(tokenProvider)`.
Verify in the browser: sign in against the Auth emulator, `GET /api/me` returns the user.

## Increment 3 — Real `StudioProvider`

`components/studio/StudioProvider.tsx` implementing the exact `MockStudioValue` interface, backed
by `useBackend()` + the adapters: real collections, likes, playback (persisted), search
(debounced → `/api/catalog/search`), library filter, create, pin. Playback drives a real
`react-player`/IFrame element (replacing the wall-clock ticker), flushing position and play events.
Mounted behind a parallel route tree first so the mock screens keep working during the swap.

## Increment 4 — Wire the screens' remaining stubs

Walk the §10 ledger UI rows: explore tiles → `/catalog/tracks?label=`; Home rails →
`/feed/*`; Search library results → `/me/library`; Stats/Recents → `/me/stats` + `/me/recents`;
Settings/Privacy inputs persist via `PATCH /api/me`; volume/shuffle/repeat/queue controls →
playback routes; follow/save/profile UI → social routes; notifications bell. Each wired row is
demonstrated in the browser.

## Increment 5 — Promote to the app root

Move the screen routes from `/design-system/screens/*` to the app root (`/`, `/search`,
`/library`, `/profile/*`, `/playlist/[id]`, `/user/[handle]`). `/design-system` reverts to the
token/component docs only (its gallery keeps pointing at the live components).

## Increment 6 — Remove the legacy app (destructive)

Delete the marketing landing, the old dashboard, `AuthContext`, `MockStudioProvider`,
`mock-data.ts` and every fixture import, `pages/api/searchEngine.ts`, `lib/search/*`,
`lib/api/shape.ts`, `lib/api/client.ts`, the legacy `Audio`/`Collection`/`User` interfaces,
`@fabricio-191/youtube`, and the legacy `/api/users/[uid]/collections` + loved-songs/collections
routes. Typecheck/build must stay green at each deletion.

## Increment 7 — Production cutover (destructive, gated on the owner)

Deploy `firestore.indexes.json` (all four composite indexes). Reset production Firestore of the
old-shape test data (D1 — confirm with the owner first). Deploy `firestore.rules` (deny-all) last.
Point the app at production (`.env.local` credential already present). Smoke-test a real sign-in
end to end.

## Verification

The §10 stub ledger is empty; `grep -r "mock-data\|MockStudio" apps/web/app` returns nothing
outside `/design-system` docs; a real user signs in, searches, plays, builds a playlist, sees
stats, follows someone, and saves a playlist — all in the browser against real data.

## Sequencing note

1–4 are additive and safe (mock screens keep running). 5 is the switch. 6–7 are destructive and
come only once 5 is proven in the browser. Each increment is its own commit series.
