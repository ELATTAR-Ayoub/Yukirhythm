# Functionality audit — 26 October 2026

Status: repaired and verified locally after repeated backend, cache, and UI passes. **Not deployed.** This report supersedes the initial audit.

## Final verification

| Check | Result |
| --- | --- |
| Full unit/component suite | **618 passed, 5 skipped** across 93 passing files and one skipped live-provider file |
| Full Firebase emulator integration suite | **114 passed**, no failures, across 13 files |
| Live YouTube provider suite, run separately | **5 passed**: search, track lookup, related tracks, suggestions, playlist lookup |
| Production build | Passed, including all application routes |
| TypeScript | Passed |
| ESLint | No errors; 12 React effect/state warnings remain |
| Browser console after the signed-in local pass | No captured error entries |

The earlier integration failures were resolved in successive rounds: 32 failures in the initial audit, six after the first repair pass, then zero. Additional adversarial tests increased the passing backend suite from 104 to 110 and finally 114 tests.

The compatibility playback/statistics tests now explicitly opt into their legacy feature flags. They verify those endpoints when enabled; they do not silently enable production synchronization. Catalog tests now enforce the intended transient-search contract rather than expecting every search to write to Firestore. Fixture events include the same retry IDs required from the real client.

## Repairs verified

### Backend writes and authorization

- A newly searched track is persisted when liked or added to a playlist. Creating a playlist no longer silently drops unstored tracks.
- Liked Songs checklist changes use the likes API rather than a nonexistent stored collection.
- Event document IDs are scoped to the authenticated user. Two users cannot overwrite each other's event by choosing the same client event ID.
- Event ingestion checks saved history consent on the server and transactionally deduplicates retries. Retrying an accepted ID cannot rewrite its track or inflate its counters.
- Concurrent tab uploads merge the bounded taste view instead of replacing it with stale client snapshots. Late listens cannot move the last-played timestamp backward.
- History deletion fences delayed uploads, deletes in bounded batches, clears taste/feed views, and preserves likes. Counter updates preserve newer listens that arrive during deletion.
- Concurrent user initialization preserves an already-created profile. Concurrent collection deletion decrements the owner's count once.
- Collection updates cannot resurrect a collection deleted between authorization and writing.
- Reordering rejects duplicate IDs instead of losing another song. Creation validates path IDs, field sizes, and track-count bounds; updates enforce the document-size ceiling.
- Null, array, and malformed request bodies follow validation paths instead of throwing property-access errors.
- Unknown/private collection visibility is denied to other users. Unlisted collections work by direct link and are absent from profile discovery.

### Cache consistency

- Mutable authenticated HTTP responses bypass the browser HTTP cache. Liked Songs no longer uses an instance-local cache that other server instances cannot invalidate.
- Single-flight request caching handles falsey values, retries failed loads, bounds stored entries, and prevents invalidated in-flight requests from repopulating stale values.
- Explicit recommendation refresh bypasses stale feed context. Empty failed feed snapshots no longer remain permanent empty results.
- Privacy changes invalidate saved feeds. A generator started under an older privacy revision cannot republish its stale snapshot afterward.
- Feed refresh ignores a late response from a previous account and deduplicates rapid refresh clicks. Cached feeds are scoped by account; the studio remounts on account changes and old backend clients cannot acquire another user's token.
- Same-device saved feed snapshots are reused by the provider. The sign-in-only provider does not start a redundant batch of library/feed requests before redirecting.

### UI and persistence

- Rapid heart toggles serialize writes and preserve the final choice. Failed writes restore confirmed state and permit retry.
- Failed library reads preserve the existing visible library; unrelated pending likes survive overlapping library reads.
- Pins are loaded on startup; failures restore the previous pin state.
- Playlist creation waits for the server-issued ID before reporting success or navigating. Playlist checklist pending feedback waits for mutation settlement.
- Privacy switches load saved values, disable while unavailable/saving, persist changes, and report failures. History clearing uses a confirmation dialog and the real clear operation.
- Listening heard while consent is off cannot be included in a later newly-consented session.
- The local history archive is separate from the upload outbox. Acknowledged events remain visible after reload, and stored track metadata keeps Recents playable.
- Local statistics derive from the latest 2,000 saved listens in this browser; the screen states that scope. The profile no longer displays fixture minutes or an invented join date/provider.
- Corrupt playback snapshots are validated. Volume restores with an empty queue; video failures settle the transport; repeating the same video remounts the ended iframe.
- Shared playlists are loaded through the authorized collection endpoint even when absent from the viewer's library. Read-only shared playlists do not offer an Add music action.
- Private playlist sharing requires an explicit successful change to unlisted visibility before copy/external share actions become available. Personal Liked Songs is not presented as a shareable playlist. Track shares use their YouTube source links.
- Settings no longer offer fake audio-quality/language buttons. Obsolete claims that sign-in/audio/network activity were simulated were replaced with descriptions of the current app.

## Signed-in local browser pass

Used an isolated Firebase emulator account, not a production account. A development-only local test-account button is gated by both development mode and the Auth emulator setting; it is absent from production builds.

Verified through the actual screens:

1. Sign in to the local emulator account and search the live catalog.
2. Start a searched track; observe the player advance, then pause it.
3. Like the track, open Liked Songs, reload, and confirm the track and heart remain saved and playback is paused.
4. Open the add-to-playlist checklist and confirm Liked Songs is checked.
5. Complete the playlist wizard with a searched song; reach its server-issued URL; reload and confirm the song remains.
6. Disable history, reload Privacy, and confirm the saved preference remains off.
7. Open the clear-history confirmation and cancel it.
8. Open Recents after upload/reload and confirm the prior listen remains visible.
9. Open a private playlist's share dialog and confirm it explains access and gates sharing behind an explicit visibility action.

Evidence: [playlist after reload](audit-evidence/playlist-after-reload.png).

## Remaining verification boundaries

- No production deployment or production account/data changes were performed. The hosted release still requires a post-deployment smoke test.
- Production Google/Facebook OAuth completion, real Spotify OAuth/import, cross-device user flows, and a complete physical-device/browser matrix were not exercised manually.
- Queue, playhead, volume, shuffle, and displayed recent listening statistics remain browser-local by design. Meaningful listening events are still persisted to the server, but the displayed statistics/history do not currently constitute a full cross-device history browser.
- Test success is evidence for the covered cases, not a guarantee that every possible backend, provider, cache, or browser failure has been eliminated.

## Reproduce

From the repository root:

```powershell
# The installed Java 17 runtime needs this compatible emulator CLI.
npx --yes firebase-tools@14.27.0 emulators:start --only firestore,auth --project demo-yukirhythm

npm run test --workspace apps/web -- --maxWorkers=2
npm run test:integration --workspace apps/web
npm run typecheck
npm run lint
npm run build

$env:CATALOG_LIVE = '1'
npm run test --workspace apps/web -- lib/catalog/youtube/contract.test.ts --maxWorkers=1
```

All database write tests targeted the local `demo-yukirhythm` emulators. Existing unrelated working-tree files were preserved.

## Guest mode follow-up

Added **Continue as guest** with a device-local personal data client. Guest likes, playlists, ordering, pins, history/stats, preferences, and playback persist in browser storage. Guest personal operations do not call the account backend. Music discovery uses a separate public provider-only read route with no Firestore access. Signed-in account behavior remains separate.

The final regression run passed **630 tests**, with **5 skipped**, across 96 passing test files and one skipped file. A focused intermediate round passed 50 guest/history/player tests. The final production build and TypeScript checks passed; lint reported zero errors and the existing 12 warnings. `git diff --check` passed.

Manual verification with Firebase emulators stopped covered guest login, live search, playback, liking, playlist creation with a selected track, full reload persistence, account labeling, and sign-out/re-entry restoring the saved library and playback position. No browser console errors were observed. Additional tests cover delayed catalog writes preserving newer edits, session isolation, local-only history/statistics, storage failures, corrupt records, and database-free guest catalog access.

See [guest mode behavior and storage boundaries](guest-mode.md) and [restored guest playlist evidence](audit-evidence/guest-playlist-restored.png). Online playlist sharing/public profiles require an account; music search and playback still require internet. Clearing site data removes guest data. Localhost and hosted origins have separate storage. These changes have not been deployed to production.
