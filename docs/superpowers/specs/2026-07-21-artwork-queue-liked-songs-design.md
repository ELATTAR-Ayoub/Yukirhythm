# Real artwork, queue integrity, and permanent Liked Songs

**Date:** 2026-07-21
**Status:** approved for planning

Seven defects reported against the running app, plus two design changes to the
add-music flow. They are grouped here because five of the seven share two root
causes: artwork is dropped at the adapter boundary, and the queue is treated as
a collection when it is not one.

---

## A. Real artwork everywhere

### The defect

Every track, card, row and vinyl disc renders a procedural `Texture` swatch
instead of the track's own thumbnail.

### Root cause

`Track.artwork: Image[]` exists in the backend model (`lib/catalog/model.ts`,
spec D6) and is populated by enrichment. `toStudioTrack` in
`lib/studio/adapt.ts` does not copy it — `MockTrack` has no artwork field at
all. `MediaCard` and `TrackRow` already accept an `artUrl` prop and already
prefer it over the texture; no caller has ever passed one.

### Design

**`lib/studio/artwork.ts`** (new, pure, unit-tested):

- `trackArtUrl(track: Track): string` — the largest entry in `track.artwork`,
  else a derived `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg` from
  `track.source.videoId`, falling back to `trackId`. That fallback is safe and
  load-bearing: `StudioProvider` already feeds `nowPlaying.id` straight into
  `https://www.youtube.com/watch?v=` to play the track, so the track id *is* the
  video id throughout. Returns `""` when neither is available.
- `collectionArtUrl(collection: Collection): string` — the stored cover image
  when `cover === "image"`, else `""`.

Deriving the YouTube URL is what makes this work on tracks that predate
enrichment, which is most of the catalogue right now.

**`components/studio/Artwork.tsx`** (new): the single component that decides
how any artwork is drawn.

```
<Artwork src={url} texture={texture} alt={title} className={...} />
```

Renders `<img>` when `src` is non-empty, and swaps to `<Texture>` on the img's
`onError`. When `src` is empty it renders `<Texture>` directly. Holding the
error fallback here — rather than at each call site — is what keeps a dead
thumbnail from leaving an empty box on one surface and a texture on another.

Plain `<img>`, not `next/image`: the codebase already establishes that pattern
in `MediaCard`/`TrackRow` with a scoped eslint-disable, and remote-pattern
config for a third-party CDN is not worth taking on here.

**Threading:**

- `MockTrack` and `MockCollection` gain `artUrl?: string`.
- `toStudioTrack` / `toStudioCollection` populate it via the helpers above.
  `toStudioCollection`'s existing `cover === "image" -> "texture"` downgrade is
  removed; an image cover now renders as an image.
- `MediaCard`, `TrackRow`, `CollectionArt`, `SpinningDisc` and `VinylDisc`
  render through `Artwork` instead of `Texture` directly.
- `CollectionArt`'s mosaic composes real thumbnails, each cell independently
  falling back to its track's texture.
- `VinylDisc`'s `DiscFace` takes `artUrl` alongside `texture`, for both the
  spinning circle and the expanded rounded-rect. The centre spindle label
  stays `tx-k2-vinyl` — it is the record label, not artwork.
- Every call site that passes `texture={track.texture}` also passes
  `artUrl={track.artUrl}`: `CollectionDetail` (rows and grid), `NowPlayingRail`,
  `AddMusicPanel`, `DevicePlayer`, `MiniPlayerBar`, `PlaybackBar`, `RailShelf`,
  `LibraryRow`, `Transport`, `PlayerSearchDrawer`, and the recents/history rows.

`Texture` is not deleted. It remains the fallback it was always documented to
be, and the design-system docs keep exercising it directly.

---

## B. The queue's `+` button leads to "Collection not found"

### The defect

Opening the queue and pressing `+` shows the "Collection not found" empty
state. Adding to the queue is unreachable from the queue itself.

### Root cause

`CollectionDetail` hardcodes `router.push(addMusicHref(collection.id))`. On the
queue route the collection is the synthetic one from `useQueueCollection()`,
whose id is the literal `"queue"`. So the button navigates to
`/playlist/queue/add`, whose page resolves `collections.find(c => c.id ===
"queue")` to `undefined` and renders the not-found state.

The deeper error is conceptual: the queue is not a playlist, so no
`/playlist/<id>/add` route can ever serve it. Adding to the queue must not
write membership to any collection.

### Design

- `routes.ts` gains `QUEUE_ADD = ${SCREENS}/queue/add`.
- New route `app/(studio)/queue/add/page.tsx` renders `<AddMusicPanel
  autoFocus />` with **no** `collection` prop. `AddMusicPanel` already treats
  the absent prop as "add to the running queue" and calls `enqueue()` rather
  than `addTrackToCollection()` — that branch exists and is correct, it simply
  had no route reaching it.
- `CollectionDetail` gains an optional `addHref?: string` prop, defaulting to
  `addMusicHref(collection.id)`. The queue page passes `QUEUE_ADD`.

No guard is added inside `addMusicHref` for the `"queue"` id; after this change
nothing constructs that path, and a guard would hide a future caller's mistake
rather than surface it.

---

## C. First run lands on the queue

### The requirement

A brand-new user's first screen should be the queue, with a working `+`, so
adding music to what is playing is the first thing available to them.

### Design

`app/page.tsx` stops being a server `redirect(HOME)` and becomes a client gate:

- Signed out → `replace(HOME)`. A signed-out user has no history by
  definition, and the queue screen would only offer them a disabled field.
- Signed in → await `backend.me.playback.get()`. Empty `queue` and no
  `trackId` → `replace(QUEUE)`. Otherwise → `replace(HOME)`.
- A failed `playback.get()` → `replace(HOME)`. A network error must not
  redefine where the app opens.

The gate renders the existing `app/loading.tsx` shell while deciding, so the
redirect is not a white flash.

Only `/` is affected. `/home` remains directly reachable and unchanged.

---

## D. The queue loses and resurrects tracks

### The defect

Tracks added from the right rail's Up next appear and disappear on their own.
The centre queue list behaves correctly: enqueued tracks persist there, survive
shuffle, and can be removed deliberately.

### Root causes — three separate bugs

**D1. `play()` rebuilds the queue.** `StudioProvider.play(track, from)`
resolves `from.trackIds` over the network and replaces `queue` wholesale.
`UpNextSection` calls `play(track, playingCollection ?? undefined)` on every row
click, so clicking a queued track destroys every other queued track — they were
in the queue, not in the playlist. This is the reported "removes music whenever
it wants".

**D2. Position is derived, not read.** `UpNextSection` computes
`tracks.findIndex(t => t.id === nowPlaying.id)` instead of reading the
provider's own `currentIndex`. With a track queued twice, `findIndex` returns
the first occurrence, so the preview shows the wrong slice — tracks that
already played reappear as upcoming.

**D3. Duplicate React keys.** Both `UpNextSection` and `CollectionDetail` key
rows by `track.id`. The queue is a list, not a set: queueing a track twice is
legitimate and produces two rows with identical keys. React then reconciles
them unpredictably — rows swap, vanish, and reappear. This is the reported
"adds music, removes music whenever it wants".

Compounding D3: the queue surfaces round-trip through
`getCollectionTracks(collection)`, which maps `trackIds` through a global
registry and **silently drops any id that does not resolve**. A track that was
enqueued but never registered disappears from the list while remaining in the
queue the player walks.

### Design

**Provider (`StudioProvider`):**

- Add `playAt(index: number)` to the context: sets `currentIndex` to that exact
  position in the running queue and starts it. No resolution, no rebuild.
- Change `play(track, from)`. It rebuilds the queue only when the call names a
  collection the player is not already inside. Precisely:

  1. `sameContext = !from || from.id === playingCollection?.id`
  2. `at = queue.findIndex(t => t.id === track.id)`
  3. If `sameContext && at >= 0` → `playAt(at)`. Nothing else changes.
  4. Otherwise → resolve `from` and rebuild, as today.

  Starting a different collection is a real intent; clicking a row in the queue
  you are already inside is not. Step 3 is the whole of the D1 fix.
- Add `dequeue(index: number)`: splices the local queue and calls the existing,
  currently-unused `backend.me.playback.removeFromQueue(index)`. Removing the
  currently-playing track adjusts `currentIndex` so playback does not jump.

**`useQueueCollection`** returns `{ collection, tracks }`, where `tracks` is the
provider's `queue` array **directly** — not ids resolved through the registry.
The queue's contents are already fully-formed `MockTrack` objects; there is no
reason to degrade them to ids and look them back up, and doing so is what makes
unresolved tracks vanish.

**`CollectionDetail`** gains an optional `tracks?: MockTrack[]` override, used
by the queue route. Rows key on `` `${track.id}:${i}` `` so duplicates are
distinct. `TrackMenu` receives the queue index when rendering a queue row.

It also gains an optional `onPlayAt?: (index: number) => void`. When supplied —
by the queue route, wired to the provider's `playAt` — rows invoke it with their
own index instead of calling `play(track, source)`. Without it, `play`'s
`findIndex` would resolve a duplicated track to its first occurrence, so
clicking the second copy would start the first. Sorting is disabled on the queue
route for the same reason: a sorted view's row index no longer addresses the
queue position, and the queue's order *is* the thing being displayed.

**`UpNextSection`** reads `currentIndex` from the provider, slices
`queue.slice(currentIndex + 1, ...)` (or from 0 when nothing has started),
tracks the absolute index alongside each row, and calls `playAt(absoluteIndex)`.

**`TrackMenu`** gains an optional `queueIndex?: number`. When present it shows
"Remove from queue", calling `dequeue(queueIndex)`. Both the centre list and the
rail rows pass it, so the two surfaces finally offer the same actions.

---

## E. Liked Songs is a permanent playlist for every user

### The defect

A new account has no Liked Songs playlist. Liking a track does not make it
appear anywhere in the library.

### Root cause

`refreshLibrary` builds the Liked Songs collection **inside** a `Promise.all`
over `collections.list()` and `me.likes()`. When `me.likes()` rejects the whole
function throws, the enclosing sign-in effect throws with it,
`setCollections` never runs and `setLibraryLoading(false)` never runs. One
failing call leaves the user with no library at all.

`me.likes()` is exactly the call most likely to fail in production: it runs
`.where("isLiked","==",true).orderBy("likedAt","desc")` over the `trackState`
subcollection, which requires the composite index that is currently blocked
from deployment. Firestore answers `FAILED_PRECONDITION`, the route 500s.

Separately, the synthesized collection is fully pinnable, unpinnable and
menu-editable, contradicting the requirement that it be permanent.

### Design

**Make the failure non-fatal:**

- `refreshLibrary` switches to `Promise.allSettled`. Liked Songs is constructed
  unconditionally, from `[]` when the likes call rejected. A missing index
  degrades to an empty Liked Songs, never to a blank library.
- The sign-in effect wraps its body in `try/finally` so `setLibraryLoading(false)`
  runs on every path. This also removes the permanent `null` render in
  `AddMusicScreen`, which returns `null` while `libraryLoading` is true.

**Make it work without the blocked index:**

`app/api/me/likes/route.ts` catches Firestore's `FAILED_PRECONDITION` and
retries with the bare `.where("isLiked","==",true)` query — which needs only the
single-field index Firestore creates automatically — sorting by `likedAt`
in memory. Liked Songs then works in production today. The composite index
remains the right answer at scale and stays in `firestore.indexes.json`; this is
a correctness fallback, not a replacement.

**Make likes land immediately:**

`toggleLike` already updates `likedIds` optimistically. It additionally splices
the track id into the Liked Songs collection's `trackIds` in local state, so the
playlist reflects the like on the click rather than after the round-trip. The
subsequent `refreshLibrary()` reconciles.

**Make it permanent:**

- `MockCollection` gains `system?: boolean`, set on Liked Songs. Identity by
  flag rather than by id comparison scattered across components.
- `CollectionMenu` renders only Share for a system collection — no pin, no
  unpin, no delete.
- `togglePin` ignores a system collection id, so no other code path can unpin it.
- `filterLibrary` sorts system collections ahead of pinned ones, so Liked Songs
  is always first in the rail.

---

## F. The rail's add control becomes a card with a `+`

### The requirement

The right rail currently carries a permanently-open search field labelled "Add
to queue". It should instead be a compact, well-designed card with a `+` button
that opens the appropriate add screen for what the user is currently looking at.

### Design

`NowPlayingRail`'s `AddMusicSection` stops embedding `<AddMusicPanel />`. It
renders a card: label, a one-line hint naming the destination, and a primary `+`
button. The full search UI lives on the add screens, which have the room for it.

**Destination is route-derived**, read from `usePathname()`:

- On `/playlist/<id>` (or its sub-routes) → `addMusicHref(id)`, so the user adds
  straight into the playlist they have open.
- Everywhere else → `QUEUE_ADD`, adding to the running queue.

Route, not `playingCollection`: the control must follow what the user is
*looking at*, not what happens to be playing behind them. A user reading a
playlist while something else plays means to add to the playlist in front of
them.

The card's hint names the destination explicitly — "to Late Study Lo-Fi" or "to
your queue" — so the button is never ambiguous about where a track will land.

`AddMusicDrawer`, which wraps the same panel in a sheet and already has no
app-flow consumer, is unaffected.

---

## G. The add screens get a proper header and loading state

### The requirement

The queue-add screen should read as a real screen: a back button and title in
the same style as Up next, then the search bar, with skeletons while results
load.

### Design

Both `/queue/add` and `/playlist/<id>/add` share the treatment:

- `BackHeader` at the top — `/queue/add` titled "Search songs" with
  `backHref={QUEUE}`; the playlist route keeps "Add music" and its existing
  back target. Same component the Up next screen uses, so the two read as
  siblings.
- A muted sub-line naming the destination: "to your queue" / "to <playlist>".
  The playlist route already has this; the queue route gains its counterpart.
- `PageTexture` behind both, matching the playlist route's existing treatment.

**In `AddMusicPanel`,** the searching state replaces the bare "Searching…"
paragraph with a short column of `SkeletonRow`s from
`components/studio/Skeletons.tsx`, which is exactly the placeholder for the
`TrackRow`s that are about to arrive. The three other states — signed out,
no query, no matches — keep their `EmptyState` blocks; a skeleton is a promise
that content is coming, and only the searching state can make it.

---

## Testing

Colocated `.test.tsx` / `.test.ts` alongside each unit, following the existing
convention.

| Unit | Test |
|---|---|
| `lib/studio/artwork.ts` | Largest-artwork selection; YouTube derivation when `artwork[]` is empty; `""` when neither. |
| `components/studio/Artwork.tsx` | Renders `img` with a src; renders `Texture` with none; swaps to `Texture` on `onError`. |
| `adapt.ts` | `toStudioTrack` carries `artUrl`; `toStudioCollection` keeps an image cover. |
| `CollectionArt` | Mosaic composes thumbnails; per-cell texture fallback. |
| `queue/add` route | Renders the panel with no collection; adding calls `enqueue`, never `addTrackToCollection`. |
| `CollectionDetail` | `addHref` overrides the default target; with `onPlayAt`, clicking the second copy of a duplicated track reports index 1, not 0. |
| `StudioProvider` | `play()` on an in-queue track preserves the queue (D1); `playAt` moves the index; `dequeue` splices and adjusts `currentIndex`. |
| `NowPlayingRail` | Clicking an Up next row keeps every other enqueued track; a duplicated track renders two stable rows (D2, D3). |
| `StudioProvider` | A rejected `me.likes()` still yields a library with an empty Liked Songs and `libraryLoading === false` (E). |
| `api/me/likes` | Falls back to the unordered query on `FAILED_PRECONDITION` and sorts in memory. |
| `library-utils` | System collections sort ahead of pinned ones. |
| `CollectionMenu` | No pin/unpin/delete for a system collection. |
| `NowPlayingRail` | The add card targets the open playlist on a playlist route, the queue elsewhere (F). |
| `AddMusicPanel` | Searching renders skeletons, not the "no matches" empty state (G). |

## Out of scope

- Backfilling `artwork[]` on existing track documents. The YouTube-derived URL
  covers those without a migration.
- Deploying the blocked `trackState` composite index. The route fallback makes
  Liked Songs correct without it.
- Queue reordering (drag to reorder). Not reported; `collections.reorder` has no
  queue counterpart.
- Deleting `AddMusicDrawer` or the mock provider.
