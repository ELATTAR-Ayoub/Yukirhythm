# Session Restore & Outstanding Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** A page refresh keeps the listening session — volume, the song that was playing, the queue and the position in it (restored paused) — and the four known issues from the first-run round are fixed.

**Context:** The backend already persists playback (`backend.me.playback.save` throttled every 10s while playing: trackId, queue, queueIndex, positionSec, isPlaying, volume; routes under `app/api/me/playback/`). Nothing ever RESTORES it — `StudioProvider` boots cold every load; the root page only reads it for cold/warm routing. Volume changes are only persisted incidentally (inside the 10s interval, and only while a track is loaded).

**Branch:** `v2_2026`. All conventions from `docs/superpowers/plans/2026-07-24-first-run-and-player-fixes.md` apply (TDD, commit per task, run from `apps/web`).

---

### Task R1: Restore the playback session on sign-in

**Files:** `apps/web/components/studio/StudioProvider.tsx`, `apps/web/components/studio/StudioProvider.test.tsx`; possibly `apps/web/components/studio/screens/HiddenYouTubePlayer.tsx` (only if a new prop is needed — prefer not).

Design:
- In the sign-in effect (after the user doc loads, alongside the feed fetches), call `backend.me.playback.get()`. If it answers with a `trackId` or a non-empty `queue`:
  - Resolve the queue's track ids to real tracks the same way `play(track, from)` does (`backend.catalog.track(id)` per id, `absorb`, drop nulls — reuse/extract that resolution rather than duplicating it).
  - `setQueue(resolved)`, `setCurrentIndex(clamped queueIndex — clamp to the resolved array; if the saved current track failed to resolve, fall back to index 0; if nothing resolved, restore nothing)`.
  - `setProgressSec(positionSec ?? 0)` and stash `pendingSeekRef.current = positionSec` — when the player mounts and `onReady` fires, `seekTo(pendingSeekRef.current)` once and clear it, so pressing play continues from where the user left off rather than 0:00.
  - `setVolumeState(clamp01(state.volume ?? 1))` (respect `preMute` semantics — a restored 0 should still unmute to something audible).
  - **Restored PAUSED** (`isPlaying` stays false): browsers block un-gestured audio autoplay, and silently "playing" UI with blocked audio is worse than an honest paused player. WHY comment required.
  - All state writes live-guarded like the rest of the effect. A failed `get()` restores nothing and must not affect the rest of sign-in (feeds etc.) — `.catch` + `console.warn`.
- Volume persistence: a `useEffect` on `volume` with a ~1s debounce calling `backend.me.playback.save` with the CURRENT full state (check the save route's required body first — if it requires trackId non-null and nothing is loaded, either the route already tolerates null (verify in `app/api/me/playback/route.ts`) or skip saving volume while idle and document why). Skip the very first run (don't save the just-restored value back).
- Tests (StudioProvider.test.tsx — extend the existing backend-mock harness): (1) a saved session restores queue/index/volume/position paused; (2) a failed playback read leaves the provider cold and feeds still load; (3) volume change persists after the debounce (fake timers); (4) restore clamps an out-of-range queueIndex.

Commit: `feat(player): restore volume, queue and position on refresh`

### Task R2: Real durations for related-tracks ingestion

**Files:** `apps/web/lib/catalog/youtube/map.ts` (or wherever `getRelatedTracks` maps), its fixtures/tests, possibly `apps/web/lib/catalog/youtube/index.ts`.

The you-might-like radio path (`provider.getRelatedTracks` → `ingestTracks`) stores `durationSec` 0/null, so the shelf renders 0:00 on every card (observed live 2026-07-25). Investigate the watch-next payload in the captured fixtures (`lib/catalog/youtube/__fixtures__/`) — the duration likely lives in a different field/format than search results (e.g. `lengthText` "3:54" needing mm:ss parsing). Fix the mapping; if the surface genuinely lacks durations, backfill via `getTracks`/`getTrack` for tracks with no duration before ingest (bounded, only the missing ones). Extend the contract/fixture test to pin non-null durations from related tracks. ALSO: in `components/studio/screens/mock-data.ts`'s `formatDuration` (or the card call sites), render an em dash or nothing instead of "0:00" when duration is 0/null — an unknown length must not claim zero. Verify with the feed integration tests.

Commit: `fix(catalog): related tracks keep their durations; unknown length no longer renders 0:00`

### Task R3: The Facebook button signs in with Facebook

**Files:** `apps/web/components/studio/screens/MockStudioProvider.tsx` (context type + mock), `apps/web/components/studio/StudioProvider.tsx`, `apps/web/components/studio/screens/SocialAuthButtons.tsx`, `apps/web/app/auth/page.test.tsx` or a SocialAuthButtons test.

`MockStudioValue.signIn` becomes `signIn: (provider?: "google" | "facebook") => void` (default google so existing callers stay valid). StudioProvider: `signIn = (provider = "google") => void fbSignIn(provider)` (fbSignIn already supports both). Mock provider: accepts and ignores the argument. SocialAuthButtons: pass the provider through (`continueWith` already knows which button was pressed; also fix its stale `onAuthed` JSDoc while in there — it fires at popup-open, and remove the premature "Signed in with X" toast OR reword it to "Opening X sign-in…" so it stops claiming a sign-in that hasn't happened). Test: clicking Continue with Facebook invokes signIn with "facebook" (probe via mock override or spy).

Commit: `fix(auth): Continue with Facebook actually opens Facebook sign-in`

### Task R4: Card play-overlays become decorative for keyboards

**Files:** `apps/web/components/studio/MediaCard.tsx`, `apps/web/components/studio/TrackRow.tsx`, `apps/web/components/studio/MediaCard.test.tsx`, `apps/web/components/studio/TrackRow.test.tsx`, `apps/web/__tests__/environment.test.tsx`.

Both components' hover play overlays render a real focusable `<button>` inside cards whose semantic control is the wrapping `role="button"` div — invalid nesting plus an invisible tab stop per card. Fix: the overlay's PlayerButton gets `tabIndex={-1}` and the overlay wrapper `aria-hidden` (WHY comment: the wrapper is the accessible control; the overlay is hover decoration). Update the three test files' role/name queries for the overlay (hidden-inclusive queries or structural assertions); every absence-assertion (`queryAllByLabelText("Play")` → 0) stays valid. Full suite green.

Commit: `fix(a11y): card play overlays are decoration, not phantom tab stops`

### Task R5: Formatting/EOL normalization + lint zero

**Files:** repo-wide formatting only; `apps/web/components/studio/Artwork.tsx`; `apps/web/components/studio/deck/Disc.tsx`; possibly `.gitattributes`.

(1) Decide/verify the EOL strategy (`.gitattributes` `* text=auto` with prettier `endOfLine`) for this Windows repo; (2) one `npx prettier --write .` commit in `apps/web` — formatting ONLY, verified by full unit suite + tsc before/after (no logic diffs: spot-check with `git diff -w --stat` ≈ empty); (3) fix the four react-hooks errors: `Artwork.tsx` refs-during-render ×2, `deck/Disc.tsx` impure-render ×2 — real fixes, not disables, unless the rule is genuinely wrong for the case (then a scoped disable with a WHY). End state: `npm run lint` exits 0 and `npm run format:check` exits 0.

Commits: `style: normalize line endings and formatting repo-wide` then `fix(lint): resolve react-hooks refs/purity errors`

### Task R6: Verification

Full unit + integration suites, typecheck, lint, format:check — ALL exit 0 now. Browser (emulator, `web-emu`): play a track, set volume ~40%, seek mid-song, wait >10s (throttled save), reload → same song shown paused at the saved position with the saved volume; press play → audio continues from there. Mobile spot-check. Push `v2_2026`.
