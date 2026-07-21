# Phase 6 — Social Implementation Plan

**Goal:** The sharing surface — follow other users, view public profiles, and save other people's
public playlists into your own library. Backend, verified against the real emulator.

**Spec:** §5.5, §8 (Users, Collections save). Roadmap phase 6.

**Scope.** Backend: follow graph, public profile, saved collections, and the owned+saved library
merge. The UI (`/profile/followers`, `/user/[handle]`, Save button, Saved filter chip, Profiles
in Search) is phase 8. Runs independently of phases 4–5.

---

## Task 1: Models

Add to `lib/catalog/model.ts` (spec §5.5): `FollowEdge` (`userId`, `followedAt`),
`SavedCollection` (`collectionId`, `ownerId`, `savedAt`, `isPinned`). Both follow directions are
stored as edges under `users/{uid}/following/{target}` and `users/{uid}/followers/{source}`.

## Task 2: Follow graph

`app/api/users/[userId]/follow/route.ts` — PUT (follow) / DELETE (unfollow).

- One transaction writes **both** edges (my `following/{target}`, their `followers/{me}`) and
  bumps both users' `counts` (`followingCount` on me, `followerCount` on them).
- **Idempotent** — following twice is a no-op, counts do not double.
- **Self-follow rejected** (400).
- Follow needs no approval and does not require the target to be public (following a private
  profile reveals nothing).

`app/api/users/[userId]/followers/route.ts` and `.../following/route.ts` — GET, paginated by a
`savedAt`/`followedAt` cursor.

**Integration test**: follow writes both edges + both counts; double-follow is a no-op; unfollow
removes both edges and decrements; self-follow 400; followers/following lists paginate.

## Task 3: Public profile

`app/api/users/[userId]/route.ts` — GET. Returns a **public projection** (displayName, handle,
avatarUrl, bio, counts) only when the target's `privacy.publicProfile === true`; otherwise 404
(a private profile is indistinguishable from a missing one). Never leaks email/settings/privacy.

**Integration test**: public user returns the projection without private fields; private user 404s
even to an authenticated caller.

## Task 4: Saved collections

`app/api/collections/[collectionId]/save/route.ts` — PUT (save) / DELETE (unsave).

- Save records `users/{uid}/savedCollections/{id}` (a reference, not a copy) and increments the
  collection's `stats.saveCount`. Only a **public** (or unlisted) collection can be saved;
  saving your own is rejected.
- Unsave deletes the record and decrements `saveCount`.
- A collection turning private after being saved drops out of the library merge but the record is
  retained, so it returns if made public again.

`app/api/collections/public/route.ts` — GET `?ownerId=`, another user's non-private collections.

Extend `GET /api/collections` to **merge owned + saved**, resolving saved refs to their live
collection docs and dropping any that are now private.

**Integration test**: save increments `saveCount` and appears in the saver's library; can't save
your own or a private collection; unsave decrements; a collection turned private disappears from
the merge but the record survives and reappears when re-published.

## Task 5: Client + demo + verify

`endpoints.users.*` and `endpoints.collections.save/publicOf` exist. Add `backend.users.*` and
`backend.collections.save/unsave/publicOf`. `scripts/demo-social.ts`: two users, one publishes a
playlist, the other follows and saves it — real emulator. Full suite + build green. Update
roadmap.

## Not in this phase

Handle uniqueness/reservation (spec §14 open question — revisit before public profiles ship in the
UI), the social UI routes, and the discovery surfaces — phase 8.
