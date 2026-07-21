# Artwork, Queue Integrity & Permanent Liked Songs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every track's real thumbnail across the app, make the running queue stop losing and duplicating tracks, and give every user a permanent Liked Songs playlist.

**Architecture:** Three independent seams. (1) Artwork enters at the adapter (`lib/studio/adapt.ts`), is carried on `MockTrack.artUrl`, and is drawn by one new `<Artwork>` component that falls back to the existing procedural `<Texture>`. (2) The queue stops being addressed as a collection: the provider gains `currentIndex`/`playAt`/`dequeue`, and queue surfaces read the `queue` array by position instead of resolving ids through a global registry. (3) Liked Songs is built unconditionally from a settled promise and flagged `system` so no UI can unpin or delete it.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, Tailwind 4, Vitest + jsdom + Testing Library, Firebase Admin (Firestore).

**Spec:** `docs/superpowers/specs/2026-07-21-artwork-queue-liked-songs-design.md`

---

## Conventions for every task

- Working directory for all commands is `apps/web`.
- Run a single test file with: `npx vitest run <path> --reporter=verbose`
- Tests are colocated: `Foo.tsx` → `Foo.test.tsx`, in the same directory.
- **Two providers implement one interface.** `MockStudioValue` in
  `components/studio/screens/MockStudioProvider.tsx` is the contract. Every
  field added to it must be implemented in **both** `MockStudioProvider` (the
  fixture provider, same file) and `components/studio/StudioProvider.tsx` (the
  real backend one), or `tsc` fails. Tasks that touch the contract say so.
- Branch is `v2_2026`. Do not push to `main`.
- Never use `next/image` — the codebase uses plain `<img>` with a scoped
  `// eslint-disable-next-line @next/next/no-img-element` comment.

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `lib/studio/artwork.ts` | Pure: pick the best artwork URL for a `Track`/`Collection`. No React. |
| `lib/studio/artwork.test.ts` | Tests for the above. |
| `components/studio/Artwork.tsx` | The single component that draws artwork: `<img>` with a `<Texture>` fallback on empty-or-broken. |
| `components/studio/Artwork.test.tsx` | Tests for the above. |
| `app/(studio)/queue/add/page.tsx` | The add-to-queue screen. Renders `AddMusicPanel` with **no** collection. |
| `app/(studio)/queue/add/page.test.tsx` | Tests for the above. |

**Modified files**

| File | Change |
|---|---|
| `lib/studio/adapt.ts` | Populate `artUrl` on tracks and collections. |
| `components/studio/screens/mock-data.ts` | `artUrl?` on `MockTrack`/`MockCollection`; `system?` on `MockCollection`. |
| `components/studio/TrackRow.tsx`, `MediaCard.tsx` | Draw through `<Artwork>`. |
| `components/studio/screens/CollectionArt.tsx` | Mosaic of real thumbnails. |
| `components/studio/SpinningDisc.tsx`, `screens/VinylDisc.tsx` | Artwork on the disc face. |
| 16 call sites (listed in Task 5) | Pass `artUrl` alongside `texture`. |
| `components/studio/screens/MockStudioProvider.tsx` | Contract + fixture impl: `currentIndex`, `playAt`, `dequeue`, fixed `play`. |
| `components/studio/StudioProvider.tsx` | Same, plus Liked Songs resilience. |
| `components/studio/screens/CollectionDetail.tsx` | `addHref`, `tracks`, `onPlayAt`, duplicate-safe keys. |
| `components/studio/shell/NowPlayingRail.tsx` | Up next by index; add-card replaces the inline field. |
| `components/studio/screens/TrackMenu.tsx` | Remove-from-queue. |
| `components/studio/screens/CollectionMenu.tsx` | No pin/delete for system collections. |
| `components/studio/screens/library-utils.ts` | System collections sort first. |
| `components/studio/screens/AddMusicPanel.tsx` | Skeleton loading state. |
| `components/studio/shell/routes.ts` | `QUEUE_ADD`. |
| `app/(studio)/queue/page.tsx` | Pass `addHref`, `tracks`, `onPlayAt`. |
| `app/(studio)/playlist/[id]/add/page.tsx` | Header polish. |
| `app/api/me/likes/route.ts` | Missing-index fallback. |
| `app/page.tsx` | First-run landing gate. |

---

# PART 1 — ARTWORK (Spec §A)

## Task 1: The artwork URL helper

**Files:**
- Create: `apps/web/lib/studio/artwork.ts`
- Test: `apps/web/lib/studio/artwork.test.ts`

**Background:** `Track.artwork` is `Image[]` where `Image = { url: string; width: number; height: number }`. `Track.source.videoId` is the YouTube id. `Collection` has `cover: "texture" | "mosaic" | "image"` and `imageUrl: string | null`.

The `trackId`-as-videoId fallback is safe: `StudioProvider` already plays tracks via `https://www.youtube.com/watch?v=${nowPlaying.id}`, so the track id **is** the video id throughout this codebase.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/studio/artwork.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { collectionArtUrl, trackArtUrl, youtubeThumbUrl } from "./artwork";
import type { Collection, Track } from "@/lib/catalog/model";

/** A Track with only the fields these helpers read. */
function track(over: Partial<Track> = {}): Track {
  return {
    trackId: "abc123",
    source: { provider: "youtube", videoId: "abc123", url: "", aliasVideoIds: [] },
    artwork: [],
    ...over,
  } as Track;
}

function collection(over: Partial<Collection> = {}): Collection {
  return { cover: "texture", imageUrl: null, ...over } as Collection;
}

describe("youtubeThumbUrl", () => {
  it("builds the hqdefault URL for a video id", () => {
    expect(youtubeThumbUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
  });

  it("returns empty for a missing id rather than a broken URL", () => {
    expect(youtubeThumbUrl("")).toBe("");
  });
});

describe("trackArtUrl", () => {
  it("prefers the widest provider artwork", () => {
    const t = track({
      artwork: [
        { url: "https://cdn/small.jpg", width: 120, height: 90 },
        { url: "https://cdn/big.jpg", width: 640, height: 480 },
        { url: "https://cdn/mid.jpg", width: 320, height: 180 },
      ],
    });
    expect(trackArtUrl(t)).toBe("https://cdn/big.jpg");
  });

  it("ignores artwork entries with no url", () => {
    const t = track({
      artwork: [
        { url: "", width: 9999, height: 9999 },
        { url: "https://cdn/real.jpg", width: 100, height: 100 },
      ],
    });
    expect(trackArtUrl(t)).toBe("https://cdn/real.jpg");
  });

  it("derives a YouTube thumbnail when artwork is empty", () => {
    // Most of the catalogue predates enrichment; without this every one of
    // those tracks would fall through to a generated texture.
    const t = track({ artwork: [], source: { provider: "youtube", videoId: "xyz789", url: "", aliasVideoIds: [] } });
    expect(trackArtUrl(t)).toBe("https://i.ytimg.com/vi/xyz789/hqdefault.jpg");
  });

  it("falls back to the track id when source.videoId is missing", () => {
    const t = track({ artwork: [] });
    delete (t as { source?: unknown }).source;
    expect(trackArtUrl(t)).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");
  });

  it("returns empty when there is nothing to build a URL from", () => {
    const t = track({ artwork: [], trackId: "" });
    delete (t as { source?: unknown }).source;
    expect(trackArtUrl(t)).toBe("");
  });
});

describe("collectionArtUrl", () => {
  it("returns the stored image for an image cover", () => {
    expect(
      collectionArtUrl(collection({ cover: "image", imageUrl: "https://cdn/c.jpg" }))
    ).toBe("https://cdn/c.jpg");
  });

  it("returns empty for texture and mosaic covers", () => {
    expect(collectionArtUrl(collection({ cover: "texture", imageUrl: "https://cdn/c.jpg" }))).toBe("");
    expect(collectionArtUrl(collection({ cover: "mosaic", imageUrl: "https://cdn/c.jpg" }))).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studio/artwork.test.ts --reporter=verbose`
Expected: FAIL — `Failed to resolve import "./artwork"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/studio/artwork.ts`:

```ts
import type { Collection, Track } from "@/lib/catalog/model";

/**
 * Where a track's picture comes from.
 *
 * Enrichment stores provider thumbnails on `Track.artwork` (spec D6), but most
 * of the catalogue predates it. Every track is a YouTube video and the track id
 * IS the video id — StudioProvider plays it as `watch?v=${track.id}` — so a
 * usable thumbnail can always be derived, and no backfill migration is needed.
 *
 * Pure. The procedural `Texture` remains the last-resort fallback, applied by
 * the `Artwork` component when these return "" or the URL fails to load.
 */

/** The standard YouTube thumbnail. `hqdefault` exists for every video. */
export function youtubeThumbUrl(videoId: string): string {
  if (!videoId) return "";
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** The best available picture for a track, or "" if there is none. */
export function trackArtUrl(track: Track): string {
  // Widest wins: these render into everything from a 36px row thumbnail to a
  // full-bleed vinyl face, and downscaling looks better than upscaling.
  const best = (track.artwork ?? [])
    .filter((a) => Boolean(a?.url))
    .reduce<{ url: string; width: number } | null>(
      (win, a) => (win === null || a.width > win.width ? a : win),
      null
    );
  if (best) return best.url;
  return youtubeThumbUrl(track.source?.videoId || track.trackId || "");
}

/** A collection's own cover image, or "" when it draws a texture/mosaic. */
export function collectionArtUrl(collection: Collection): string {
  return collection.cover === "image" ? (collection.imageUrl ?? "") : "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/studio/artwork.test.ts --reporter=verbose`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/studio/artwork.ts apps/web/lib/studio/artwork.test.ts
git commit -m "feat(studio): resolve real artwork URLs for tracks and collections"
```

---

## Task 2: The `<Artwork>` component

**Files:**
- Create: `apps/web/components/studio/Artwork.tsx`
- Test: `apps/web/components/studio/Artwork.test.tsx`

**Background:** `Texture` is at `components/studio/Texture.tsx` and exports `TextureName` plus a default component taking `{ name, className }`. This component centralises the broken-image fallback so a dead thumbnail can never leave an empty box on one surface and a texture on another.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/studio/Artwork.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Artwork from "./Artwork";

describe("Artwork", () => {
  it("renders the image when a src is given", () => {
    render(<Artwork src="https://cdn/a.jpg" texture="tx-k-silk" alt="Realize" />);
    const img = screen.getByRole("img", { name: "Realize" });
    expect(img).toHaveAttribute("src", "https://cdn/a.jpg");
  });

  it("renders the texture when no src is given", () => {
    const { container } = render(
      <Artwork src="" texture="tx-k-silk" alt="Realize" />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstChild).toBeTruthy();
  });

  it("falls back to the texture when the image fails to load", () => {
    // A 404 from the thumbnail CDN must not leave a blank square — that is
    // strictly worse than the generated texture it replaced.
    const { container } = render(
      <Artwork src="https://cdn/gone.jpg" texture="tx-k-silk" alt="Realize" />
    );
    fireEvent.error(screen.getByRole("img", { name: "Realize" }));
    expect(container.querySelector("img")).toBeNull();
  });

  it("retries when the src changes after a failure", () => {
    // Without resetting on src change, one broken thumbnail would poison the
    // element for every later track that reuses it (the disc faces do).
    const { container, rerender } = render(
      <Artwork src="https://cdn/gone.jpg" texture="tx-k-silk" alt="A" />
    );
    fireEvent.error(screen.getByRole("img", { name: "A" }));
    expect(container.querySelector("img")).toBeNull();

    rerender(<Artwork src="https://cdn/good.jpg" texture="tx-k-silk" alt="B" />);
    expect(screen.getByRole("img", { name: "B" })).toHaveAttribute(
      "src",
      "https://cdn/good.jpg"
    );
  });

  it("marks decorative artwork aria-hidden with an empty alt", () => {
    render(<Artwork src="https://cdn/a.jpg" texture="tx-k-silk" alt="" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/studio/Artwork.test.tsx --reporter=verbose`
Expected: FAIL — `Failed to resolve import "./Artwork"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/components/studio/Artwork.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import Texture, { type TextureName } from "@/components/studio/Texture";

interface ArtworkProps {
  /** Resolved by lib/studio/artwork.ts. Empty means "no picture available". */
  src?: string;
  /** The procedural fallback — deterministic per track, so it is stable. */
  texture?: TextureName;
  /** Empty string for decorative art whose label is already in the row. */
  alt: string;
  className?: string;
}

/**
 * The one place artwork is drawn.
 *
 * Every surface — rows, cards, mosaics, the vinyl disc — renders through this
 * rather than reaching for `<Texture>` or an `<img>` directly, so a track
 * cannot show its thumbnail in one place and a generated swatch in another,
 * and a dead CDN URL degrades identically everywhere.
 */
export default function Artwork({
  src,
  texture,
  alt,
  className,
}: ArtworkProps) {
  const [failed, setFailed] = useState(false);

  // A disc face keeps the same element across track changes, so a single 404
  // would otherwise stick to every track that follows it.
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <Texture name={texture ?? "tx-k-marble"} className={className} />;
  }

  return (
    // Plain <img>: the codebase's established pattern, and next/image would
    // need remote-pattern config for a third-party CDN to buy nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/studio/Artwork.test.tsx --reporter=verbose`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/Artwork.tsx apps/web/components/studio/Artwork.test.tsx
git commit -m "feat(studio): add Artwork, the single artwork-with-texture-fallback component"
```

---

## Task 3: Carry `artUrl` through the data layer

**Files:**
- Modify: `apps/web/components/studio/screens/mock-data.ts` (the `MockTrack` and `MockCollection` interfaces near the top)
- Modify: `apps/web/lib/studio/adapt.ts:20-49`
- Test: `apps/web/lib/studio/adapt.test.ts` (exists — add cases)

- [ ] **Step 1: Write the failing test**

Append these cases inside `apps/web/lib/studio/adapt.test.ts`. Add `toStudioCollection` to the existing import from `./adapt` if it is not already there.

```ts
describe("artwork carried onto the studio shapes", () => {
  it("carries the widest provider artwork onto the track", () => {
    const t = {
      trackId: "abc123",
      title: "Realize",
      artists: [{ artistId: "a1", name: "鈴木このみ" }],
      durationSec: 244,
      texture: "tx-k2-vinyl",
      artwork: [
        { url: "https://cdn/small.jpg", width: 120, height: 90 },
        { url: "https://cdn/big.jpg", width: 640, height: 480 },
      ],
      source: { provider: "youtube", videoId: "abc123", url: "", aliasVideoIds: [] },
    } as unknown as Parameters<typeof toStudioTrack>[0];

    expect(toStudioTrack(t).artUrl).toBe("https://cdn/big.jpg");
  });

  it("derives a YouTube thumbnail for a track with no stored artwork", () => {
    const t = {
      trackId: "xyz789",
      title: "il vento d'oro",
      artists: [{ artistId: "a2", name: "YUGO KANNO" }],
      durationSec: 296,
      texture: "tx-k-silk",
      artwork: [],
      source: { provider: "youtube", videoId: "xyz789", url: "", aliasVideoIds: [] },
    } as unknown as Parameters<typeof toStudioTrack>[0];

    expect(toStudioTrack(t).artUrl).toBe(
      "https://i.ytimg.com/vi/xyz789/hqdefault.jpg"
    );
  });

  it("keeps an image cover as an image instead of downgrading it to a texture", () => {
    // The old adapter rewrote cover:"image" to "texture" because the mock art
    // components could not render a remote image. Artwork can, so the
    // downgrade is now pure data loss.
    const c = {
      collectionId: "c1",
      title: "Late Study Lo-Fi",
      description: "Quiet loops.",
      texture: "tx-k2-topo",
      cover: "image",
      imageUrl: "https://cdn/cover.jpg",
      tracks: [],
      tags: [],
      contentType: "music",
      stats: { trackCount: 0, totalDurationSec: 0, saveCount: 0, playCount: 0 },
    } as unknown as Parameters<typeof toStudioCollection>[0];

    const out = toStudioCollection(c);
    expect(out.cover).toBe("image");
    expect(out.artUrl).toBe("https://cdn/cover.jpg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studio/adapt.test.ts --reporter=verbose`
Expected: FAIL — `artUrl` is `undefined`; the cover case receives `"texture"`.

- [ ] **Step 3: Add the fields to the mock shapes**

In `apps/web/components/studio/screens/mock-data.ts`, replace the `MockTrack` interface:

```ts
export interface MockTrack {
  id: string;
  title: string;
  artist: string;
  texture: TextureName;
  durationSec: number;
  /** The track's real thumbnail. Absent or broken falls back to `texture` —
   *  see components/studio/Artwork.tsx. Fixture tracks have none. */
  artUrl?: string;
}
```

In the same file, add two fields to `MockCollection`, immediately after its `cover` field:

```ts
  /** A stored cover image, when `cover` is "image". */
  artUrl?: string;
  /** Built-in and permanent — Liked Songs. Cannot be unpinned or deleted,
   *  and always sorts first in the library. */
  system?: boolean;
```

Also widen `cover` on `MockCollection` to include the image case:

```ts
  cover?: "texture" | "mosaic" | "image";
```

- [ ] **Step 4: Populate them in the adapter**

In `apps/web/lib/studio/adapt.ts`, add the import at the top:

```ts
import { collectionArtUrl, trackArtUrl } from "./artwork";
```

Replace `toStudioTrack` and the `cover` line of `toStudioCollection`:

```ts
export function toStudioTrack(t: Track): MockTrack {
  return {
    id: t.trackId,
    title: t.title,
    // The screens show one artist string; join the structured list.
    artist: t.artists.map((a) => a.name).join(", ") || "Unknown",
    texture: t.texture,
    durationSec: t.durationSec ?? 0,
    artUrl: trackArtUrl(t),
  };
}
```

and inside `toStudioCollection`, replace the `cover:` line and its comment with:

```ts
    // An image cover renders as an image now that Artwork can draw one; it
    // used to be downgraded to the texture swatch, which was data loss.
    cover: c.cover,
    artUrl: collectionArtUrl(c),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/studio/adapt.test.ts --reporter=verbose`
Expected: PASS, including the pre-existing cases.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `CollectionArt`'s `CollectionArtSource.cover` complains about the widened union, widen it there too:
`cover?: "texture" | "mosaic" | "image";`

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/studio/screens/mock-data.ts apps/web/lib/studio/adapt.ts apps/web/lib/studio/adapt.test.ts
git commit -m "feat(studio): carry real artwork URLs from the backend onto the screen shapes"
```

---

## Task 4: Draw artwork in `TrackRow` and `MediaCard`

**Files:**
- Modify: `apps/web/components/studio/TrackRow.tsx`
- Modify: `apps/web/components/studio/MediaCard.tsx`
- Test: `apps/web/components/studio/TrackRow.test.tsx`, `apps/web/components/studio/MediaCard.test.tsx` (both exist — add cases)

Both already accept `artUrl` and already prefer it over the texture; this task routes them through `Artwork` so they inherit the broken-image fallback.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/components/studio/TrackRow.test.tsx`:

```tsx
it("falls back to the texture when the artwork URL fails to load", () => {
  const { container } = render(
    <TrackRow title="Realize" artUrl="https://cdn/gone.jpg" texture="tx-k-silk" />
  );
  const img = container.querySelector("img")!;
  expect(img).toBeTruthy();
  fireEvent.error(img);
  expect(container.querySelector("img")).toBeNull();
});
```

Ensure `fireEvent` is in the `@testing-library/react` import of that file.

Append to `apps/web/components/studio/MediaCard.test.tsx`:

```tsx
it("falls back to the texture when the artwork URL fails to load", () => {
  const { container } = render(
    <MediaCard title="Realize" artUrl="https://cdn/gone.jpg" texture="tx-k-silk" />
  );
  const img = container.querySelector("img")!;
  expect(img).toBeTruthy();
  fireEvent.error(img);
  expect(container.querySelector("img")).toBeNull();
});
```

Ensure `fireEvent` is imported there too.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/TrackRow.test.tsx components/studio/MediaCard.test.tsx --reporter=verbose`
Expected: FAIL — the `img` survives the error event, so `querySelector("img")` is still non-null.

- [ ] **Step 3: Route `TrackRow` through `Artwork`**

In `apps/web/components/studio/TrackRow.tsx`, replace the `Texture` import:

```tsx
import Artwork from "@/components/studio/Artwork";
import { type TextureName } from "@/components/studio/Texture";
```

Replace the whole artwork block (the `artUrl ? <img …/> : <Texture …/>` conditional) with:

```tsx
        <Artwork
          src={artUrl}
          texture={texture ?? "tx-k-silk"}
          alt=""
          className="absolute inset-0 w-full h-full"
        />
```

`alt=""` on purpose: the title sits next to it in the same row, so announcing the art repeats it.

- [ ] **Step 4: Route `MediaCard` through `Artwork`**

In `apps/web/components/studio/MediaCard.tsx`, replace the `Texture` import the same way:

```tsx
import Artwork from "@/components/studio/Artwork";
import { TextureName } from "@/components/studio/Texture";
```

Replace the body of the local `Artwork` helper — rename it to `CardArt` to avoid shadowing the import, and update its two call sites (`<Artwork …/>` inside the extended and boxy branches become `<CardArt …/>`):

```tsx
function CardArt({
  texture,
  artUrl,
  art,
  title,
  className,
}: {
  texture?: TextureName;
  artUrl?: string;
  art?: React.ReactNode;
  title: string;
  className?: string;
}) {
  if (art) {
    return <div className={className}>{art}</div>;
  }
  return (
    <Artwork src={artUrl} texture={texture ?? "tx-k-marble"} alt={title} className={className} />
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/studio/TrackRow.test.tsx components/studio/MediaCard.test.tsx --reporter=verbose`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/TrackRow.tsx apps/web/components/studio/MediaCard.tsx apps/web/components/studio/TrackRow.test.tsx apps/web/components/studio/MediaCard.test.tsx
git commit -m "feat(studio): draw rows and cards through Artwork so thumbnails degrade to textures"
```

---

## Task 5: Pass `artUrl` at every call site

**Files (all Modify):**

```
apps/web/components/studio/screens/AddMusicPanel.tsx:142
apps/web/components/studio/screens/CollectionDetail.tsx:240
apps/web/components/studio/screens/CollectionDetail.tsx:270
apps/web/components/studio/screens/CreatePlaylistFlow.tsx:366
apps/web/components/studio/screens/CreatePlaylistFlow.tsx:401
apps/web/components/studio/screens/CreatePlaylistFlow.tsx:486
apps/web/components/studio/screens/MiniPlayerBar.tsx:52
apps/web/components/studio/screens/PlayerSearchDrawer.tsx:91
apps/web/components/studio/shell/NowPlayingRail.tsx:124
apps/web/components/studio/shell/PlaybackBar.tsx:57
apps/web/app/(studio)/home/page.tsx:93
apps/web/app/(studio)/profile/recents/page.tsx:74
apps/web/app/(studio)/profile/stats/page.tsx:91
apps/web/app/(studio)/search/page.tsx:59
apps/web/app/(studio)/search/page.tsx:183
```

(`DevicePlayer.tsx:111` is the vinyl and is handled in Task 6.)

- [ ] **Step 1: Find every site**

Run: `git grep -n "texture={track\.texture}\|texture={t\.texture}\|texture={nowPlaying\.texture}" -- apps/web/components apps/web/app`
Expected: the 15 lines above plus `DevicePlayer.tsx:111`.

- [ ] **Step 2: Add the prop at each**

At each of the 15 lines, add an `artUrl` prop immediately after the `texture` prop, matching the same object the texture came from:

- where the line reads `texture={track.texture}` → add `artUrl={track.artUrl}`
- where it reads `texture={t.texture}` → add `artUrl={t.artUrl}`
- where it reads `texture={nowPlaying.texture}` → add `artUrl={nowPlaying.artUrl}`

Do **not** touch `DevicePlayer.tsx:111`.

- [ ] **Step 3: Verify none were missed**

Run: `git grep -n "texture={track\.texture}\|texture={t\.texture}\|texture={nowPlaying\.texture}" -- apps/web/components apps/web/app | grep -v "artUrl"`

Then inspect each result — the only acceptable remaining hit is `DevicePlayer.tsx`. (The prop is on the following line, so a plain grep will still match the `texture=` line; read each hit rather than trusting the count.)

- [ ] **Step 4: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components apps/web/app
git commit -m "feat(studio): pass real artwork to every track row and card in the app"
```

---

## Task 6: Artwork on the vinyl disc

**Files:**
- Modify: `apps/web/components/studio/SpinningDisc.tsx`
- Modify: `apps/web/components/studio/screens/VinylDisc.tsx`
- Modify: `apps/web/components/studio/screens/DevicePlayer.tsx:110-112`
- Test: `apps/web/components/studio/screens/VinylDisc.test.tsx` (exists — add a case)

**Background:** `VinylDisc` holds two persistent layers that trade places on a track change, keyed by fixed slot index so `SpinningDisc` stays mounted across a swap. Artwork must therefore be carried **on the layer**, alongside the texture, or a swap would show the new track's texture with the old track's photo.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/components/studio/screens/VinylDisc.test.tsx`:

```tsx
it("renders the track's artwork on the disc face", () => {
  const { container } = render(
    <VinylDisc
      texture="tx-k-silk"
      artUrl="https://cdn/realize.jpg"
      trackKey="abc123"
      direction={null}
      spinning={false}
      expanded={false}
      onToggle={() => {}}
    />
  );
  const img = container.querySelector('img[src="https://cdn/realize.jpg"]');
  expect(img).toBeTruthy();
});

it("swaps artwork with the texture when the track changes", () => {
  // The two disc layers persist across a swap by design. Artwork has to ride
  // on the layer or the new track would wear the old track's photo.
  const { container, rerender } = render(
    <VinylDisc
      texture="tx-k-silk"
      artUrl="https://cdn/one.jpg"
      trackKey="one"
      direction={null}
      spinning={false}
      expanded={false}
      onToggle={() => {}}
    />
  );
  rerender(
    <VinylDisc
      texture="tx-k2-vinyl"
      artUrl="https://cdn/two.jpg"
      trackKey="two"
      direction={null}
      spinning={false}
      expanded={false}
      onToggle={() => {}}
    />
  );
  expect(container.querySelector('img[src="https://cdn/two.jpg"]')).toBeTruthy();
  expect(container.querySelector('img[src="https://cdn/one.jpg"]')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/studio/screens/VinylDisc.test.tsx --reporter=verbose`
Expected: FAIL — `artUrl` is not a prop; no `img` is rendered.

- [ ] **Step 3: Accept artwork in `SpinningDisc`**

In `apps/web/components/studio/SpinningDisc.tsx`, add to `SpinningDiscProps` after `texture`:

```ts
  /** The track's real thumbnail; falls back to `texture` when absent/broken. */
  artUrl?: string;
```

Add `artUrl` to the destructured params, add the import:

```tsx
import Artwork from "@/components/studio/Artwork";
```

and replace the face line inside the rotating span:

```tsx
        {art ?? (
          <Artwork
            src={artUrl}
            texture={texture}
            alt=""
            className="absolute inset-0 w-full h-full"
          />
        )}
```

Leave the spindle `labelTexture` as `<Texture>` — that is the record label, not artwork.

- [ ] **Step 4: Carry artwork on the `VinylDisc` layers**

In `apps/web/components/studio/screens/VinylDisc.tsx`:

Add the import:

```tsx
import Artwork from "@/components/studio/Artwork";
```

Add to `VinylDiscProps` after `texture`:

```ts
  /** The track's real thumbnail; falls back to `texture`. */
  artUrl?: string;
```

Change `DiscFace` to take and use it:

```tsx
function DiscFace({
  texture,
  artUrl,
  spinning,
  expanded,
}: {
  texture: TextureName;
  artUrl?: string;
  spinning: boolean;
  expanded: boolean;
}) {
  // Expanded it fills a rounded rect, where any rotation would swing the
  // artwork's corners off the card — so only the circle spins.
  if (expanded) {
    return (
      <div className="absolute inset-0">
        <Artwork
          src={artUrl}
          texture={texture}
          alt=""
          className="absolute inset-0 w-full h-full"
        />
        <div
          className={cn(
            "absolute inset-0 m-auto w-16 h-16 rounded-full overflow-hidden",
            "border-4 border-card transition-opacity duration-500 opacity-0"
          )}
        >
          <Texture name="tx-k2-vinyl" className="w-full h-full" />
        </div>
      </div>
    );
  }

  return (
    <SpinningDisc
      texture={texture}
      artUrl={artUrl}
      labelTexture="tx-k2-vinyl"
      spinning={spinning}
      className="absolute inset-0"
      labelClassName="w-16 h-16 border-4 border-card"
    />
  );
}
```

Widen the layer state to carry artwork. Replace the `useState` initialiser:

```tsx
  const [layers, setLayers] = useState<
    { texture: TextureName | null; artUrl?: string; cls: string }[]
  >([
    { texture, artUrl, cls: "" },
    { texture: null, cls: "" },
  ]);
```

In the swap effect, replace both `setLayers` calls so artwork moves with the texture:

```tsx
    if (!direction) {
      setLayers((l) =>
        l.map((layer, i) =>
          i === active ? { ...layer, texture, artUrl } : layer
        )
      );
      return;
    }

    const incoming = active === 0 ? 1 : 0;
    const out =
      direction === "prev" ? "disc-arc-out-right" : "disc-arc-out-left";
    const into =
      direction === "prev" ? "disc-arc-in-left" : "disc-arc-in-right";
    setLayers((l) =>
      l.map((layer, i) =>
        i === incoming ? { texture, artUrl, cls: into } : { ...layer, cls: out }
      )
    );
    setActive(incoming);
```

Add `artUrl` to that effect's dependency array: `}, [trackKey, texture, artUrl, direction, active]);`

Pass it down in the render:

```tsx
              <DiscFace
                texture={layer.texture}
                artUrl={layer.artUrl}
                // only the disc on stage keeps turning
                spinning={spinning && i === active}
                expanded={expanded}
              />
```

- [ ] **Step 5: Pass it from `DevicePlayer`**

In `apps/web/components/studio/screens/DevicePlayer.tsx`, add one line after line 111:

```tsx
          artUrl={nowPlaying.artUrl}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/studio/screens/VinylDisc.test.tsx components/studio/SpinningDisc.test.tsx components/studio/screens/DevicePlayer.test.tsx --reporter=verbose`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/studio/SpinningDisc.tsx apps/web/components/studio/screens/VinylDisc.tsx apps/web/components/studio/screens/VinylDisc.test.tsx apps/web/components/studio/screens/DevicePlayer.tsx
git commit -m "feat(studio): put the track's real artwork on the vinyl disc face"
```

---

## Task 7: Real artwork in the collection mosaic

**Files:**
- Modify: `apps/web/components/studio/screens/CollectionArt.tsx`
- Test: `apps/web/components/studio/screens/CollectionArt.test.tsx` (exists — add cases)

- [ ] **Step 1: Write the failing test**

Append to `apps/web/components/studio/screens/CollectionArt.test.tsx`:

```tsx
it("renders the collection's own cover image when it has one", () => {
  const { container } = render(
    <CollectionArt
      collection={{
        texture: "tx-k-silk",
        cover: "image",
        artUrl: "https://cdn/cover.jpg",
        trackIds: [],
      }}
    />
  );
  expect(container.querySelector('img[src="https://cdn/cover.jpg"]')).toBeTruthy();
});

it("composes the mosaic from the tracks' real thumbnails", () => {
  registerStudioTracks([
    { id: "m1", title: "One", artist: "A", texture: "tx-k-silk", durationSec: 1, artUrl: "https://cdn/1.jpg" },
    { id: "m2", title: "Two", artist: "B", texture: "tx-k-marble", durationSec: 1, artUrl: "https://cdn/2.jpg" },
  ]);

  const { container } = render(
    <CollectionArt
      collection={{ texture: "tx-k-silk", cover: "mosaic", trackIds: ["m1", "m2"] }}
    />
  );
  expect(container.querySelector('img[src="https://cdn/1.jpg"]')).toBeTruthy();
  expect(container.querySelector('img[src="https://cdn/2.jpg"]')).toBeTruthy();
});

it("falls back per cell when only some tracks have artwork", () => {
  registerStudioTracks([
    { id: "m3", title: "Three", artist: "C", texture: "tx-k-silk", durationSec: 1, artUrl: "https://cdn/3.jpg" },
    { id: "m4", title: "Four", artist: "D", texture: "tx-k-marble", durationSec: 1 },
  ]);

  const { container } = render(
    <CollectionArt
      collection={{ texture: "tx-k-silk", cover: "mosaic", trackIds: ["m3", "m4"] }}
    />
  );
  // One real image, one texture cell — not an empty square.
  expect(container.querySelectorAll("img")).toHaveLength(1);
});
```

Add `registerStudioTracks` to the file's import from `./mock-data`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/studio/screens/CollectionArt.test.tsx --reporter=verbose`
Expected: FAIL — no `img` elements are produced.

- [ ] **Step 3: Write the implementation**

Replace the body of `apps/web/components/studio/screens/CollectionArt.tsx` below the imports. Change the import line from `Texture` to add `Artwork`:

```tsx
import { cn } from "@/lib/utils";
import Artwork from "@/components/studio/Artwork";
import { getTrack, type MockTrack } from "./mock-data";
import type { TextureName } from "@/components/studio/Texture";

/** The minimum shape CollectionArt needs — satisfied by both `MockCollection`
 *  and the wizard's `Draft` (same field names throughout), so the review
 *  step can hand its live draft straight in without adapting it. */
export interface CollectionArtSource {
  texture: TextureName;
  cover?: "texture" | "mosaic" | "image";
  /** A stored cover image, when `cover` is "image". */
  artUrl?: string;
  trackIds: string[];
}

function tracksFor(trackIds: string[]): MockTrack[] {
  return trackIds.map(getTrack).filter((t): t is MockTrack => t !== undefined);
}

/** One mosaic cell — the track's thumbnail, its texture if that is all we have. */
function Cell({ track, className }: { track: MockTrack; className?: string }) {
  return (
    <Artwork
      src={track.artUrl}
      texture={track.texture}
      alt=""
      className={className}
    />
  );
}

/**
 * One 2-wide cell, one full-height cell — the lead track gets the bigger
 * share, the next two are supporting. Matches the asymmetric split most
 * mosaic pickers (Spotify included) use for exactly three images: a plain
 * 2x2 grid would leave a blank fourth quadrant, and three equal columns
 * reads as a filmstrip rather than a cover.
 */
function ThreeUp({ tracks }: { tracks: MockTrack[] }) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2">
      <Cell track={tracks[0]} className="row-span-2 h-full w-full" />
      <Cell track={tracks[1]} className="h-full w-full" />
      <Cell track={tracks[2]} className="h-full w-full" />
    </div>
  );
}

interface CollectionArtProps {
  collection: CollectionArtSource;
  className?: string;
}

/**
 * Renders a collection's art — its own cover image, a collage of its tracks'
 * artwork, or its texture swatch. The single place that decides how a
 * collection's art looks; every surface that draws one should render through
 * this rather than reading `.texture` directly, or a collection would show its
 * collage in one place and a plain swatch in another.
 *
 * `className` should carry sizing (w/h) and rounding — it is applied to
 * whichever path renders.
 */
export default function CollectionArt({ collection, className }: CollectionArtProps) {
  const cover = collection.cover ?? "texture";

  // An uploaded cover wins outright: the owner chose it over any collage.
  if (cover === "image" && collection.artUrl) {
    return (
      <Artwork
        src={collection.artUrl}
        texture={collection.texture}
        alt=""
        className={className}
      />
    );
  }

  const tracks = cover === "mosaic" ? tracksFor(collection.trackIds).slice(0, 4) : [];

  if (tracks.length === 0) {
    return (
      <Artwork src="" texture={collection.texture} alt="" className={className} />
    );
  }
  if (tracks.length === 1) {
    return <Cell track={tracks[0]} className={className} />;
  }
  if (tracks.length === 2) {
    return (
      <div className={cn("grid grid-cols-2 overflow-hidden", className)}>
        <Cell track={tracks[0]} className="h-full w-full" />
        <Cell track={tracks[1]} className="h-full w-full" />
      </div>
    );
  }
  if (tracks.length === 3) {
    return (
      <div className={cn("overflow-hidden", className)}>
        <ThreeUp tracks={tracks} />
      </div>
    );
  }
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 overflow-hidden", className)}>
      {tracks.map((t, i) => (
        <Cell key={`${t.id}:${i}`} track={t} className="h-full w-full" />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/studio/screens/CollectionArt.test.tsx --reporter=verbose`
Expected: PASS, including the pre-existing cases.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green. Part 1 is complete — every surface now draws real artwork.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/screens/CollectionArt.tsx apps/web/components/studio/screens/CollectionArt.test.tsx
git commit -m "feat(studio): compose collection art from real cover images and track thumbnails"
```

---

# PART 2 — THE QUEUE (Spec §B, §D)

## Task 8: The `/queue/add` route

**Files:**
- Modify: `apps/web/components/studio/shell/routes.ts`
- Create: `apps/web/app/(studio)/queue/add/page.tsx`
- Create: `apps/web/app/(studio)/queue/add/page.test.tsx`
- Modify: `apps/web/components/studio/screens/CollectionDetail.tsx:118-133, 194-208`
- Modify: `apps/web/app/(studio)/queue/page.tsx`
- Test: `apps/web/components/studio/screens/CollectionDetail.test.tsx` (exists — add a case)
- Test: `apps/web/app/(studio)/queue/page.test.tsx` (exists — add a case)

**Background — the bug:** `CollectionDetail` hardcodes `router.push(addMusicHref(collection.id))`. On the queue route the collection is synthetic with id `"queue"`, so the button lands on `/playlist/queue/add`, which looks up `collections.find(c => c.id === "queue")`, finds nothing, and renders "Collection not found". `AddMusicPanel` already does the right thing when given **no** `collection` prop — it calls `enqueue()` instead of `addTrackToCollection()` — that branch simply had no route reaching it.

- [ ] **Step 1: Add the route constant**

In `apps/web/components/studio/shell/routes.ts`, after the `QUEUE` export:

```ts
/** Add-to-queue. Deliberately NOT `/playlist/queue/add`: the queue is not a
 *  collection, has no id to look up, and adding to it must write to no
 *  playlist. Routing it through the playlist add screen is what produced the
 *  "Collection not found" error. */
export const QUEUE_ADD = `${QUEUE}/add`;
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/app/(studio)/queue/add/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { MOCK_COLLECTIONS, MOCK_TRACKS } from "@/components/studio/screens/mock-data";
import { QUEUE } from "@/components/studio/shell/routes";
import QueueAddScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/queue/add",
  useRouter: () => ({ push }),
}));

/** Surfaces the queue and a collection's size so the test can prove where a
 *  track landed — and, just as importantly, where it did not. */
function Probe() {
  const { queue, collections } = useMockStudio();
  const first = collections.find((c) => c.id === MOCK_COLLECTIONS[0].id);
  return (
    <>
      <div data-testid="queue">{queue.map((t) => t.id).join(",")}</div>
      <div data-testid="c0-size">{first?.trackIds.length ?? -1}</div>
    </>
  );
}

describe("queue add screen", () => {
  beforeEach(() => push.mockClear());

  it("offers a back route to the queue and a search field", () => {
    render(
      <MockStudioProvider>
        <QueueAddScreen />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Back")).toHaveAttribute("href", QUEUE);
    expect(screen.getByLabelText("Search tracks to queue")).toBeInTheDocument();
  });

  it("never renders the collection-not-found state", () => {
    // The whole point of this route: the queue has no id to look up, so the
    // add flow must not go looking for one.
    render(
      <MockStudioProvider>
        <QueueAddScreen />
      </MockStudioProvider>
    );
    expect(screen.queryByText("Collection not found")).toBeNull();
  });

  it("adds a searched track to the running queue and to no playlist", async () => {
    const target = MOCK_TRACKS[0];
    const sizeBefore = MOCK_COLLECTIONS[0].trackIds.length;

    render(
      <MockStudioProvider>
        <QueueAddScreen />
        <Probe />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Search tracks to queue"), {
      target: { value: target.title },
    });

    const add = await screen.findByLabelText(
      `Add ${target.title} to queue`,
      {},
      { timeout: 3000 }
    );
    fireEvent.click(add);

    await waitFor(() => {
      expect(screen.getByTestId("queue").textContent).toContain(target.id);
    });
    expect(screen.getByTestId("c0-size").textContent).toBe(String(sizeBefore));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run "app/(studio)/queue/add/page.test.tsx" --reporter=verbose`
Expected: FAIL — `Failed to resolve import "./page"`.

- [ ] **Step 4: Write the route**

Create `apps/web/app/(studio)/queue/add/page.tsx`:

```tsx
"use client";

import BackHeader from "@/components/studio/screens/BackHeader";
import AddMusicPanel from "@/components/studio/screens/AddMusicPanel";
import PageTexture from "@/components/studio/screens/PageTexture";
import { QUEUE } from "@/components/studio/shell/routes";

/**
 * Add music to the running queue.
 *
 * `AddMusicPanel` with no `collection` means "enqueue" — nothing is written to
 * any playlist. This route exists because the queue is not a collection: it has
 * no id, so `/playlist/<id>/add` can never serve it, and pointing the queue's
 * "+" at that route is what rendered "Collection not found".
 *
 * No library lookup and no loading gate: there is nothing to resolve, so this
 * screen is usable the instant it mounts.
 */
export default function QueueAddScreen() {
  return (
    <div className="relative pb-8">
      <PageTexture />
      {/* Lifted above the texture — it sits at z-0 rather than behind the
          column's opaque background. */}
      <div className="relative z-10">
        <BackHeader title="Search songs" backHref={QUEUE} />
        <p className="type-muted -mt-4 mb-4 truncate">to your queue</p>
        <AddMusicPanel autoFocus />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "app/(studio)/queue/add/page.test.tsx" --reporter=verbose`
Expected: PASS — 3 tests.

- [ ] **Step 6: Write the failing test for `addHref`**

Append to `apps/web/components/studio/screens/CollectionDetail.test.tsx`:

```tsx
it("routes the add button to addHref when one is given", () => {
  // The queue passes its own destination; without this the button builds
  // /playlist/queue/add from the synthetic id and dead-ends.
  render(
    <MockStudioProvider>
      <CollectionDetail collection={MOCK_COLLECTIONS[0]} addHref="/queue/add" />
    </MockStudioProvider>
  );
  fireEvent.click(screen.getByLabelText("Add music"));
  expect(push).toHaveBeenCalledWith("/queue/add");
});
```

Match the file's existing `next/navigation` mock and imports; if it has no `push` mock yet, add one in the same `vi.hoisted` + `vi.mock` style used by `NowPlayingRail.test.tsx`.

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run components/studio/screens/CollectionDetail.test.tsx --reporter=verbose`
Expected: FAIL — `push` was called with `/playlist/c1/add`.

- [ ] **Step 8: Add the `addHref` prop**

In `apps/web/components/studio/screens/CollectionDetail.tsx`, add to `CollectionDetailProps`:

```ts
  /** Where the "+" goes. Defaults to this collection's add-music route. The
   *  queue passes its own, because the queue has no id to build one from. */
  addHref?: string;
```

Add `addHref` to the destructured params, and replace the button's `onClick`:

```tsx
            onClick={() => router.push(addHref ?? addMusicHref(collection.id))}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npx vitest run components/studio/screens/CollectionDetail.test.tsx --reporter=verbose`
Expected: PASS.

- [ ] **Step 10: Wire the queue page**

In `apps/web/app/(studio)/queue/page.tsx`, import `QUEUE_ADD` alongside `HOME`:

```tsx
import { HOME, QUEUE_ADD } from "@/components/studio/shell/routes";
```

and pass it:

```tsx
      <CollectionDetail
        collection={collection}
        playFrom={playingCollection ?? undefined}
        addHref={QUEUE_ADD}
      />
```

- [ ] **Step 11: Add the regression test on the queue page**

Append to `apps/web/app/(studio)/queue/page.test.tsx`:

```tsx
it("sends the add button to the queue's own add route, never /playlist/queue/add", () => {
  render(
    <MockStudioProvider>
      <QueueScreen />
    </MockStudioProvider>
  );
  fireEvent.click(screen.getByLabelText("Add music"));
  expect(push).toHaveBeenCalledWith("/queue/add");
  expect(push).not.toHaveBeenCalledWith("/playlist/queue/add");
});
```

Match that file's existing mocks; add a `push` mock in the `vi.hoisted` style if it lacks one.

- [ ] **Step 12: Run tests to verify they pass**

Run: `npx vitest run "app/(studio)/queue" components/studio/screens/CollectionDetail.test.tsx --reporter=verbose`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add apps/web/components/studio/shell/routes.ts "apps/web/app/(studio)/queue" apps/web/components/studio/screens/CollectionDetail.tsx apps/web/components/studio/screens/CollectionDetail.test.tsx
git commit -m "fix(queue): give the queue its own add route instead of a dead playlist path"
```

---

## Task 9: Provider — `currentIndex`, `playAt`, `dequeue`, and a `play` that stops destroying the queue

**Files:**
- Modify: `apps/web/components/studio/screens/MockStudioProvider.tsx` (interface + fixture impl)
- Modify: `apps/web/components/studio/StudioProvider.tsx` (real impl)
- Test: `apps/web/components/studio/screens/MockStudioProvider.test.tsx` (exists — add cases)

**Background — the bug (spec D1):** `play(track, from)` rebuilds the queue from `from.trackIds`, wholesale. `UpNextSection` calls `play(track, playingCollection)` on every row click, so clicking a queued track deletes every *other* queued track — they were in the queue, not in the playlist. This is the reported "removes music whenever it wants".

This task changes the shared contract, so **both providers must be updated together** or `tsc` fails.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/components/studio/screens/MockStudioProvider.test.tsx`:

```tsx
describe("the queue is not the playlist", () => {
  it("keeps enqueued tracks when a row inside the running queue is clicked", () => {
    // The reported bug: play() resolved the collection and replaced the whole
    // queue, so clicking any row threw away everything the user had queued.
    const source = MOCK_COLLECTIONS[0];
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });

    act(() => {
      result.current.play(getCollectionTracks(source)[0], source);
    });
    const extra = MOCK_TRACKS.find((t) => !source.trackIds.includes(t.id))!;
    act(() => {
      result.current.enqueue(extra);
    });
    expect(result.current.queue.map((t) => t.id)).toContain(extra.id);

    // Click a different row of the same running queue.
    act(() => {
      result.current.play(
        getCollectionTracks(source)[1],
        result.current.playingCollection ?? undefined
      );
    });

    expect(result.current.queue.map((t) => t.id)).toContain(extra.id);
    expect(result.current.nowPlaying?.id).toBe(getCollectionTracks(source)[1].id);
  });

  it("rebuilds the queue when a genuinely different collection is played", () => {
    // Starting another playlist IS an instruction to replace what is queued.
    const a = MOCK_COLLECTIONS[0];
    const b = MOCK_COLLECTIONS[1];
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });

    act(() => {
      result.current.play(getCollectionTracks(a)[0], a);
    });
    act(() => {
      result.current.play(getCollectionTracks(b)[0], b);
    });

    expect(result.current.playingCollection?.id).toBe(b.id);
    expect(result.current.queue.map((t) => t.id)).toEqual(b.trackIds);
  });

  it("playAt addresses a queue position, so a duplicate plays the copy clicked", () => {
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });
    const dup = MOCK_TRACKS[0];

    act(() => {
      result.current.play(dup);
    });
    act(() => {
      result.current.enqueue(dup);
    });
    const at = result.current.queue.length - 1;

    act(() => {
      result.current.playAt(at);
    });

    expect(result.current.currentIndex).toBe(at);
  });

  it("dequeue removes exactly one position, not every copy of the track", () => {
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });
    const dup = MOCK_TRACKS[0];

    act(() => {
      result.current.play(dup);
    });
    act(() => {
      result.current.enqueue(dup);
    });
    const before = result.current.queue.length;

    act(() => {
      result.current.dequeue(before - 1);
    });

    expect(result.current.queue).toHaveLength(before - 1);
    expect(result.current.queue.map((t) => t.id)).toContain(dup.id);
  });

  it("keeps playing the same track when an earlier queue entry is removed", () => {
    // Removing something above the playhead must not shift what is audible.
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });
    const source = MOCK_COLLECTIONS[0];

    act(() => {
      result.current.play(getCollectionTracks(source)[2], source);
    });
    const playing = result.current.nowPlaying?.id;

    act(() => {
      result.current.dequeue(0);
    });

    expect(result.current.nowPlaying?.id).toBe(playing);
  });
});
```

Ensure the file imports `act`, `renderHook`, `MOCK_COLLECTIONS`, `MOCK_TRACKS` and `getCollectionTracks`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/screens/MockStudioProvider.test.tsx --reporter=verbose`
Expected: FAIL — `playAt`/`dequeue`/`currentIndex` are not functions/fields, and the first test shows the queue rebuilt without `extra`.

- [ ] **Step 3: Extend the shared contract**

In `apps/web/components/studio/screens/MockStudioProvider.tsx`, add to the `MockStudioValue` interface, right after `play`:

```ts
  /** The playhead's position in `queue`. Surfaces that show the queue must
   *  read this rather than searching for `nowPlaying` by id — a track may
   *  legitimately sit in the queue more than once, and findIndex would answer
   *  with the wrong copy. */
  currentIndex: number;
  /** Start the track at this exact queue position. The queue is untouched.
   *  This — not `play` — is what a click on a queue row means. */
  playAt: (index: number) => void;
  /** Drop exactly one position from the running queue. Not "remove this
   *  track": a duplicate must lose only the copy the user pointed at. */
  dequeue: (index: number) => void;
```

- [ ] **Step 4: Implement in the fixture provider**

In the same file, replace `play` and add the two new callbacks beneath it:

```tsx
  const playAt = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return;
      setNavDirection(null);
      startLoad(index);
    },
    [queue.length, startLoad]
  );

  const play = useCallback(
    (track: MockTrack, from?: MockCollection) => {
      // Clicking a row in the queue you are already inside is not a request to
      // rebuild that queue. Only naming a DIFFERENT collection is.
      const sameContext = !from || from.id === playingCollection?.id;
      const at = queue.findIndex((t) => t.id === track.id);
      if (sameContext && at >= 0) {
        setNavDirection(null);
        startLoad(at);
        return;
      }

      const source = from ?? null;
      const nextQueue = source ? getCollectionTracks(source) : LIBRARY_QUEUE;
      const idx = nextQueue.findIndex((t) => t.id === track.id);
      setPlayingCollection(source);
      setQueue(nextQueue);
      setNavDirection(null);
      startLoad(idx >= 0 ? idx : 0);
    },
    [startLoad, playingCollection, queue]
  );

  const dequeue = useCallback(
    (index: number) => {
      setQueue((q) => {
        if (index < 0 || index >= q.length) return q;
        return [...q.slice(0, index), ...q.slice(index + 1)];
      });
      // Everything above the playhead shifts down by one, so the index has to
      // follow or a removal would silently change what is playing.
      setCurrentIndex((i) => (index < i ? i - 1 : i));
    },
    []
  );
```

Add `currentIndex`, `playAt` and `dequeue` to the `value` object and to its `useMemo` dependency array.

- [ ] **Step 5: Implement in the real provider**

In `apps/web/components/studio/StudioProvider.tsx`, replace `play` and add the new callbacks after it:

```tsx
  const playAt = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return;
      flushEvent();
      setNavDirection(null);
      startTrack(index);
    },
    [queue.length, flushEvent, startTrack]
  );

  const play = useCallback(
    async (track: MockTrack, from?: MockCollection) => {
      // Clicking a row in the queue you are already inside must not rebuild
      // that queue — everything enqueued from the rail lives only there.
      const sameContext = !from || from.id === playingCollection?.id;
      const at = queue.findIndex((t) => t.id === track.id);
      if (sameContext && at >= 0) {
        flushEvent();
        setNavDirection(null);
        startTrack(at);
        return;
      }

      flushEvent();
      let q: MockTrack[];
      if (from) {
        // resolve the collection's tracks to real objects
        const resolved = await Promise.all(
          from.trackIds.map((id) => backend.catalog.track(id).catch(() => null))
        );
        q = absorb(resolved.filter((t): t is Track => t !== null));
      } else {
        q = [track];
      }
      const idx = q.findIndex((t) => t.id === track.id);
      setPlayingCollection(from ?? null);
      setQueue(q.length ? q : [track]);
      setNavDirection(null);
      startTrack(idx >= 0 ? idx : 0);
    },
    [backend, absorb, flushEvent, startTrack, playingCollection, queue]
  );

  const dequeue = useCallback(
    (index: number) => {
      setQueue((q) => {
        if (index < 0 || index >= q.length) return q;
        return [...q.slice(0, index), ...q.slice(index + 1)];
      });
      setCurrentIndex((i) => (index < i ? i - 1 : i));
      // Best-effort, same as enqueue: a failed write must not resurrect a row
      // the user just removed, and the next save() flush re-sends the list.
      void backend.me.playback.removeFromQueue(index).catch(() => {});
    },
    [backend]
  );
```

Add `currentIndex`, `playAt` and `dequeue` to the `value` object and to its dependency array.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/studio/screens/MockStudioProvider.test.tsx --reporter=verbose`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. A missing field in either provider surfaces here.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/studio/screens/MockStudioProvider.tsx apps/web/components/studio/StudioProvider.tsx apps/web/components/studio/screens/MockStudioProvider.test.tsx
git commit -m "fix(player): stop play() from destroying the queue; add playAt and dequeue"
```

---

## Task 10: Up next reads the queue by position

**Files:**
- Modify: `apps/web/components/studio/shell/NowPlayingRail.tsx:51-137`
- Test: `apps/web/components/studio/shell/NowPlayingRail.test.tsx` (exists — add cases)

**Background — two bugs:**
- **D2:** `UpNextSection` computes `tracks.findIndex(t => t.id === nowPlaying.id)` instead of reading `currentIndex`. With a track queued twice, `findIndex` returns the *first* copy, so already-played tracks reappear as upcoming.
- **D3:** rows are keyed by `track.id`. The queue is a list, not a set — queueing a track twice is legitimate and produces two identical React keys, which React then reconciles unpredictably: rows swap, vanish and reappear. This is the reported "adds music, removes music whenever it wants".

It also stops routing through `getCollectionTracks`, which maps ids through a global registry and **silently drops** any that fail to resolve — a track can be in the queue the player walks while being invisible in the list.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/components/studio/shell/NowPlayingRail.test.tsx`:

```tsx
describe("up next reads the queue by position", () => {
  /** Enqueues the same track twice so duplicate handling is exercised. */
  function SeedDuplicate() {
    const { play, enqueue } = useMockStudio();
    const [a, b] = getCollectionTracks(MOCK_COLLECTIONS[0]);
    return (
      <button
        onClick={() => {
          play(a, MOCK_COLLECTIONS[0]);
          enqueue(b);
          enqueue(b);
        }}
      >
        seed-dup
      </button>
    );
  }

  it("renders both copies of a track queued twice", () => {
    // Keyed by track id, React collapsed and reshuffled these rows — the
    // "adds and removes music whenever it wants" report.
    render(
      <MockStudioProvider>
        <SeedDuplicate />
        <NowPlayingRail />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed-dup"));

    const [, b] = getCollectionTracks(MOCK_COLLECTIONS[0]);
    expect(screen.getAllByLabelText(`Play ${b.title}`).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps every enqueued track when an up-next row is clicked", () => {
    // The rail used to call play(track, playingCollection), which rebuilt the
    // queue from the playlist and threw away everything queued.
    render(
      <MockStudioProvider>
        <SeedDuplicate />
        <NowPlayingRail />
        <QueueProbe />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed-dup"));
    const before = screen.getByTestId("queue-len").textContent;

    fireEvent.click(screen.getAllByLabelText(/^Play /)[0]);

    expect(screen.getByTestId("queue-len").textContent).toBe(before);
  });

  it("previews what follows the playhead, not what precedes it", () => {
    render(
      <MockStudioProvider>
        <SeedDuplicate />
        <NowPlayingRail />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed-dup"));

    const [a] = getCollectionTracks(MOCK_COLLECTIONS[0]);
    // `a` is playing at index 0; it must not also appear as upcoming.
    const upNext = screen.getByRole("region", { name: "Up next" });
    expect(within(upNext).queryByLabelText(`Play ${a.title}`)).toBeNull();
  });
});
```

Add this probe near the file's other probes:

```tsx
/** Surfaces the queue length so a click can be proven non-destructive. */
function QueueProbe() {
  const { queue } = useMockStudio();
  return <div data-testid="queue-len">{queue.length}</div>;
}
```

Ensure the file imports `MOCK_COLLECTIONS` and `within`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/shell/NowPlayingRail.test.tsx --reporter=verbose`
Expected: FAIL — one copy rendered instead of two, and the queue shrinks after the click.

- [ ] **Step 3: Rewrite `UpNextSection`**

In `apps/web/components/studio/shell/NowPlayingRail.tsx`, replace the whole `UpNextSection` function with:

```tsx
function UpNextSection() {
  const { queue, currentIndex, playAt } = useMockStudio();
  const router = useRouter();

  // Read straight off the queue — not `getCollectionTracks(useQueueCollection())`.
  // That path degraded the queue's own MockTrack objects to ids, looked them
  // back up in a global registry, and silently dropped any that missed, so a
  // queued track could be inaudible-in-the-list yet still in the queue.
  //
  // The offset is what makes each row addressable: `upcoming[i]` lives at
  // `start + i` in the queue, and that absolute position — never a findIndex
  // on the track id — is what a click acts on. A track may sit in the queue
  // more than once, and id lookup would answer with the wrong copy.
  const start = currentIndex >= 0 ? currentIndex + 1 : 0;
  const upcoming = queue.slice(start, start + UPCOMING_CAP);

  const playKeyHandler = (at: number) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playAt(at);
    }
  };

  return (
    // A named region, taking its name from the label already on screen rather
    // than repeating the string — the rail holds three distinct areas and
    // "the queue preview" needs to be addressable as one of them.
    <section aria-labelledby="up-next-label" className="shrink-0">
      {/* Asymmetric on purpose, to line the header up with the rows beneath
          it: the list is inset px-3 and TrackRow adds another px-3, so the
          artwork starts 24px in — pl-6 puts the label on that same edge. The
          rows' trailing control sits 12px from the rail edge, so pr-3 puts
          the queue button on the same column as the hearts. */}
      <div className="flex items-center justify-between gap-2 pl-6 pr-3 pt-5 pb-2">
        <SectionLabel id="up-next-label">Up next</SectionLabel>
        <PlayerButton
          variant="ghost"
          size="sm"
          aria-label="Open queue"
          onClick={() => router.push(QUEUE)}
          data-signal="queue_open"
        >
          <ListBulletIcon />
        </PlayerButton>
      </div>

      {upcoming.length === 0 ? (
        // One quiet line, not a full empty-state block. An empty queue is the
        // normal resting state of the rail, so it must not dominate it.
        <p className="px-6 pb-3 text-sm text-muted-foreground">
          Nothing queued yet.
        </p>
      ) : (
        <div className="px-3 pb-2 space-y-1">
          {upcoming.map((track, i) => {
            const at = start + i;
            return (
              // Keyed by POSITION, not by track id. The queue is a list, not a
              // set: the same track may legitimately appear twice, and two
              // rows sharing a key is what made them swap and vanish.
              <div key={`${track.id}:${at}`} className="flex items-center gap-1">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${track.title}`}
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => playAt(at)}
                  onKeyDown={playKeyHandler(at)}
                >
                  {/* No play overlay: this row sits inside a role="button" div,
                      and TrackRow's overlay would nest a button inside it. */}
                  <TrackRow
                    index={at + 1}
                    title={track.title}
                    artist={track.artist}
                    duration={formatDuration(track.durationSec)}
                    texture={track.texture}
                    artUrl={track.artUrl}
                    playable={false}
                  />
                </div>
                {/* Siblings of the row, not children — nesting them in the
                    role="button" wrapper would make each a dead keyboard stop. */}
                <LikeButton trackId={track.id} trackTitle={track.title} />
                <TrackMenu track={track} queueIndex={at} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

Update the file's imports: add `TrackMenu`, and drop `useQueueCollection` and `getCollectionTracks` if nothing else in the file uses them.

```tsx
import TrackMenu from "@/components/studio/screens/TrackMenu";
import { formatDuration } from "@/components/studio/screens/mock-data";
```

`TrackMenu`'s `queueIndex` prop is added in Task 11 — until then `tsc` will flag it. That is expected; the two tasks land in sequence.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/studio/shell/NowPlayingRail.test.tsx --reporter=verbose`
Expected: PASS. (Pre-existing cases that assert on `useQueueCollection` behaviour in this file may need their queries updated — keep their intent, update the mechanism.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/shell/NowPlayingRail.tsx apps/web/components/studio/shell/NowPlayingRail.test.tsx
git commit -m "fix(queue): address up-next rows by queue position so duplicates stop vanishing"
```

---

## Task 11: Remove from queue

**Files:**
- Modify: `apps/web/components/studio/screens/TrackMenu.tsx`
- Test: `apps/web/components/studio/screens/TrackMenu.test.tsx` (exists — add cases)

`backend.me.playback.removeFromQueue(index)` already exists in the client and has never had a caller. `dequeue` (Task 9) wraps it.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/components/studio/screens/TrackMenu.test.tsx`:

```tsx
it("offers Remove from queue only when the row is in the queue", async () => {
  render(
    <MockStudioProvider>
      <TrackMenu track={MOCK_TRACKS[0]} />
    </MockStudioProvider>
  );
  fireEvent.click(screen.getByLabelText(`More for ${MOCK_TRACKS[0].title}`));
  expect(await screen.findByText("Like")).toBeInTheDocument();
  expect(screen.queryByText("Remove from queue")).toBeNull();
});

it("removes the exact queue position it was given", async () => {
  function Probe() {
    const { queue } = useMockStudio();
    return <div data-testid="queue-len">{queue.length}</div>;
  }

  render(
    <MockStudioProvider>
      <TrackMenu track={MOCK_TRACKS[0]} queueIndex={0} />
      <Probe />
    </MockStudioProvider>
  );
  const before = Number(screen.getByTestId("queue-len").textContent);

  fireEvent.click(screen.getByLabelText(`More for ${MOCK_TRACKS[0].title}`));
  fireEvent.click(await screen.findByText("Remove from queue"));

  expect(Number(screen.getByTestId("queue-len").textContent)).toBe(before - 1);
});
```

Ensure the file imports `useMockStudio` and `MOCK_TRACKS`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/screens/TrackMenu.test.tsx --reporter=verbose`
Expected: FAIL — `queueIndex` is not a prop; the menu item does not exist.

- [ ] **Step 3: Write the implementation**

In `apps/web/components/studio/screens/TrackMenu.tsx`, add `MinusIcon` to the `@radix-ui/react-icons` import, add to `TrackMenuProps`:

```ts
  /**
   * This row's position in the running queue, when it is a queue row. A
   * position, not a boolean: removing must drop the copy the user pointed at,
   * and a track may sit in the queue more than once.
   */
  queueIndex?: number;
```

Add `queueIndex` to the destructured params, pull `dequeue` from the context:

```tsx
  const { isLiked, toggleLike, dequeue } = useMockStudio();
```

and insert this menu item immediately after the "Add to playlist" item:

```tsx
          {queueIndex !== undefined ? (
            <DropdownMenuItem onClick={() => dequeue(queueIndex)}>
              <MinusIcon className="mr-2 h-3.5 w-3.5" /> Remove from queue
            </DropdownMenuItem>
          ) : null}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/studio/screens/TrackMenu.test.tsx --reporter=verbose`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — this closes the `queueIndex` gap opened in Task 10.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/screens/TrackMenu.tsx apps/web/components/studio/screens/TrackMenu.test.tsx
git commit -m "feat(queue): let a track be removed from the running queue by position"
```

---

## Task 12: The centre queue list, duplicate-safe

**Files:**
- Modify: `apps/web/components/studio/screens/CollectionDetail.tsx`
- Modify: `apps/web/app/(studio)/queue/page.tsx`
- Test: `apps/web/components/studio/screens/CollectionDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/components/studio/screens/CollectionDetail.test.tsx`:

```tsx
it("reports the clicked position when given a tracks override and onPlayAt", () => {
  // Without a position, play() resolves a duplicated track by findIndex and
  // starts the FIRST copy — clicking the second row would play the first.
  const onPlayAt = vi.fn();
  const dup = MOCK_TRACKS[0];

  render(
    <MockStudioProvider>
      <CollectionDetail
        collection={MOCK_COLLECTIONS[0]}
        tracks={[dup, MOCK_TRACKS[1], dup]}
        onPlayAt={onPlayAt}
      />
    </MockStudioProvider>
  );

  fireEvent.click(screen.getAllByLabelText(`Play ${dup.title}`)[1]);
  expect(onPlayAt).toHaveBeenCalledWith(2);
});

it("renders every copy of a duplicated track", () => {
  const dup = MOCK_TRACKS[0];
  render(
    <MockStudioProvider>
      <CollectionDetail
        collection={MOCK_COLLECTIONS[0]}
        tracks={[dup, MOCK_TRACKS[1], dup]}
        onPlayAt={() => {}}
      />
    </MockStudioProvider>
  );
  expect(screen.getAllByLabelText(`Play ${dup.title}`)).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/screens/CollectionDetail.test.tsx --reporter=verbose`
Expected: FAIL — `tracks`/`onPlayAt` are not props.

- [ ] **Step 3: Add the props**

In `apps/web/components/studio/screens/CollectionDetail.tsx`, add to `CollectionDetailProps`:

```ts
  /** Render these rows instead of resolving `collection.trackIds`. The queue
   *  passes its live `queue` array: its tracks are already whole objects, and
   *  round-tripping them through the id registry drops any that miss. */
  tracks?: MockTrack[];
  /**
   * Play by position rather than by track. Supplied by the queue, where a row
   * addresses a queue slot — `play()` would resolve a duplicated track to its
   * first copy, so clicking the second row would start the first.
   */
  onPlayAt?: (index: number) => void;
```

Import `type MockTrack` from `./mock-data` if it is not already imported.

Add `tracks: tracksProp` and `onPlayAt` to the destructured params, and replace the `tracks` derivation:

```tsx
  const source = playFrom ?? collection;
  // Sorting is suppressed for a positional list: a sorted row index no longer
  // addresses the underlying slot, and the queue's order IS the content.
  const rows = tracksProp ?? getCollectionTracks(collection);
  const tracks = onPlayAt ? rows : sortTracks(rows, sort);
```

Replace the two key handlers and both row click handlers so they route through position when `onPlayAt` is given:

```tsx
  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler =
    (track: (typeof tracks)[number], at: number) => (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onPlayAt) onPlayAt(at);
        else play(track, source);
      }
    };

  const activate = (track: (typeof tracks)[number], at: number) =>
    onPlayAt ? onPlayAt(at) : play(track, source);
```

In the rows branch, change the map and the key, and pass artwork and the queue index:

```tsx
          {tracks.map((track, i) => (
            <div key={`${track.id}:${i}`} className="flex items-center gap-2">
              <div
                role="button"
                tabIndex={0}
                aria-label={`Play ${track.title}`}
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => activate(track, i)}
                onKeyDown={playKeyHandler(track, i)}
              >
                {/* No play overlay: this row sits inside a role="button" div,
                    and TrackRow's overlay would nest a button inside it. */}
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  artUrl={track.artUrl}
                  playing={nowPlaying?.id === track.id && isPlaying}
                  playable={false}
                  desktop
                  album={collection.title}
                />
              </div>
              {/* Siblings of the row, not children: the row is a role="button"
                  and nesting controls inside it would make each a dead
                  keyboard stop that only works because the click bubbles. */}
              <LikeButton trackId={track.id} trackTitle={track.title} />
              <TrackMenu
                track={track}
                collection={collection}
                queueIndex={onPlayAt ? i : undefined}
              />
            </div>
          ))}
```

In the grid branch, do the same for the key and click:

```tsx
          {tracks.map((track, i) => (
            <div
              key={`${track.id}:${i}`}
              role="button"
              tabIndex={0}
              aria-label={`Play ${track.title}`}
              className="text-left cursor-pointer"
              onClick={() => activate(track, i)}
              onKeyDown={playKeyHandler(track, i)}
            >
              <MediaCard
                title={track.title}
                artist={track.artist}
                texture={track.texture}
                artUrl={track.artUrl}
                size="sm"
                playing={nowPlaying?.id === track.id && isPlaying}
                className="w-full"
              />
            </div>
          ))}
```

Hide the sort control when positional, since it cannot apply:

```tsx
        {onPlayAt ? <span /> : <SortControl sort={sort} onChange={setSort} />}
```

- [ ] **Step 4: Wire the queue page**

Replace the body of `apps/web/app/(studio)/queue/page.tsx`:

```tsx
export default function QueueScreen() {
  const { playingCollection, queue, playAt } = useMockStudio();
  const collection = useQueueCollection();

  return (
    <div className="pb-8">
      <BackHeader title={collection.title} backHref={HOME} />
      <CollectionDetail
        collection={collection}
        playFrom={playingCollection ?? undefined}
        addHref={QUEUE_ADD}
        // The queue's own objects, played by position — the two things that
        // keep duplicates and unresolved tracks honest here.
        tracks={queue}
        onPlayAt={playAt}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/studio/screens/CollectionDetail.test.tsx "app/(studio)/queue" --reporter=verbose`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green. Part 2 is complete.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/studio/screens/CollectionDetail.tsx apps/web/components/studio/screens/CollectionDetail.test.tsx "apps/web/app/(studio)/queue/page.tsx"
git commit -m "fix(queue): render the centre queue by position so duplicates survive"
```

---

# PART 3 — LIKED SONGS (Spec §E)

## Task 13: Liked Songs survives a failing likes call

**Files:**
- Modify: `apps/web/components/studio/StudioProvider.tsx:108-192`
- Test: `apps/web/components/studio/StudioProvider.test.tsx` (create if absent)

**Background — the bug:** `refreshLibrary` builds Liked Songs **inside** a `Promise.all` over `collections.list()` and `me.likes()`. When `me.likes()` rejects, the whole function throws, the enclosing sign-in effect throws with it, and neither `setCollections` nor `setLibraryLoading(false)` ever runs — so the user gets **no library at all**, not merely no Liked Songs. `me.likes()` is the call most likely to fail in production: it needs a composite index that is currently blocked from deployment, and Firestore answers `FAILED_PRECONDITION`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/studio/StudioProvider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS_ID } from "@/components/studio/screens/mock-data";

const { backend, authState } = vi.hoisted(() => ({
  backend: {
    me: {
      ensure: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ userId: "u1", displayName: "Yuki", email: "y@x.dev" }),
      likes: vi.fn(),
      stats: vi.fn().mockRejectedValue(new Error("no")),
      recents: vi.fn().mockRejectedValue(new Error("no")),
      library: vi.fn().mockResolvedValue({ collections: [], tracks: [] }),
      setTrackState: vi.fn().mockResolvedValue({}),
      setPin: vi.fn().mockResolvedValue({}),
      playback: {
        get: vi.fn().mockResolvedValue({ queue: [], trackId: null }),
        save: vi.fn().mockResolvedValue({}),
        enqueue: vi.fn().mockResolvedValue({}),
        removeFromQueue: vi.fn().mockResolvedValue({}),
      },
    },
    collections: { list: vi.fn() },
    feed: {
      jumpBackIn: vi.fn().mockRejectedValue(new Error("no")),
      newReleases: vi.fn().mockRejectedValue(new Error("no")),
      youMightLike: vi.fn().mockRejectedValue(new Error("no")),
    },
    catalog: { track: vi.fn(), search: vi.fn() },
    events: { ingest: vi.fn() },
  },
  authState: { user: { uid: "u1", displayName: "Yuki", email: "y@x.dev", photoURL: null, providerData: [{ providerId: "google.com" }] } },
}));

vi.mock("@/lib/studio/useBackend", () => ({ useBackend: () => backend }));
vi.mock("@/lib/studio/useAuth", () => ({
  useAuthState: () => authState,
  signIn: vi.fn(),
  signOutUser: vi.fn(),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import StudioProvider from "./StudioProvider";

function Probe() {
  const { collections, libraryLoading } = useMockStudio();
  const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
  return (
    <>
      <div data-testid="loading">{String(libraryLoading)}</div>
      <div data-testid="count">{collections.length}</div>
      <div data-testid="liked">{liked ? liked.title : "missing"}</div>
      <div data-testid="liked-system">{String(liked?.system ?? false)}</div>
    </>
  );
}

describe("StudioProvider library load", () => {
  beforeEach(() => {
    backend.collections.list.mockResolvedValue([]);
    backend.me.likes.mockResolvedValue({ trackIds: [], tracks: [] });
  });

  it("gives a brand-new account a Liked Songs playlist", async () => {
    render(
      <StudioProvider>
        <Probe />
      </StudioProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
    expect(screen.getByTestId("liked-system").textContent).toBe("true");
  });

  it("still builds the library when the likes call fails", async () => {
    // The composite index this endpoint needs is blocked in production. One
    // rejected promise used to take the ENTIRE library down with it — the
    // user saw no playlists at all, and libraryLoading never cleared.
    backend.me.likes.mockRejectedValue(new Error("FAILED_PRECONDITION: index"));

    render(
      <StudioProvider>
        <Probe />
      </StudioProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
  });

  it("still builds the library when the collections call fails", async () => {
    backend.collections.list.mockRejectedValue(new Error("boom"));

    render(
      <StudioProvider>
        <Probe />
      </StudioProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/StudioProvider.test.tsx --reporter=verbose`
Expected: FAIL — the failure cases hang on `loading === "true"`, and `liked-system` is `"false"`.

- [ ] **Step 3: Make the library load resilient**

In `apps/web/components/studio/StudioProvider.tsx`, replace `refreshLibrary`:

```tsx
  const refreshLibrary = useCallback(async () => {
    // allSettled, not all: these are independent reads, and the Liked Songs
    // endpoint needs a composite index that is not deployed yet. One rejection
    // used to throw out of here, out of the sign-in effect above it, and leave
    // the user with NO library and libraryLoading stuck true.
    const [ownedRes, likedRes] = await Promise.allSettled([
      backend.collections.list(),
      backend.me.likes(),
    ]);

    const likedTracks =
      likedRes.status === "fulfilled" ? likedRes.value.tracks : [];
    absorb(likedTracks);
    setLikedIds(new Set(likedTracks.map((t) => t.trackId)));

    // Built unconditionally. Every user has this playlist, always — an empty
    // one when the read failed, never a missing one.
    const likedCollection: MockCollection = {
      id: LIKED_ID,
      title: "Liked Songs",
      desc: "Everything you liked.",
      texture: "tx-k2-vinyl",
      trackIds: likedTracks.map((t) => t.trackId),
      likes: 0,
      tags: ["liked"],
      kind: "music",
      pinned: true,
      system: true,
    };

    const owns =
      ownedRes.status === "fulfilled"
        ? ownedRes.value.map((c) =>
            toStudioCollection(c, { pinned: pinnedIds.has(c.collectionId) })
          )
        : [];
    setCollections([likedCollection, ...owns]);
  }, [backend, absorb, pinnedIds]);
```

Then wrap the sign-in effect's body so the loading flag always clears. Replace the effect's async IIFE structure with a `try/finally`:

```tsx
  useEffect(() => {
    let live = true;
    (async () => {
      if (!fbUser) {
        setUser(null);
        setCollections([]);
        setLibraryLoading(false);
        return;
      }
      try {
        // ensure the user doc exists, then load it
        const provider =
          fbUser.providerData[0]?.providerId?.includes("facebook")
            ? "facebook"
            : "google";
        await backend.me.ensure({
          displayName: fbUser.displayName ?? "",
          email: fbUser.email ?? "",
          avatarUrl: fbUser.photoURL ?? null,
          authProvider: provider,
        });
        const me = await backend.me.get();
        if (!live || !me) return;
        setUser(toStudioUser(me));
        await refreshLibrary();
      } catch {
        // A failed load must not leave the app permanently "loading". The
        // library stays as-is; the rails render their own empty states.
      } finally {
        if (live) setLibraryLoading(false);
      }

      // Feeds and profile data. Each is independent — one failing rail must not
      // blank the others, so they settle separately.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      void backend.feed.jumpBackIn().then(
        (r) => live && setJumpBackIn(r.collections.map((c) => toStudioCollection(c))),
        () => {}
      );
      void backend.feed.newReleases().then(
        (r) => live && setNewReleases(absorb(r.items.map((i) => i.track))),
        () => {}
      );
      void backend.feed.youMightLike().then(
        (r) => live && setYouMightLike(absorb(r.items.map((i) => i.track))),
        () => {}
      );
      void backend.me.stats(tz).then(
        (s) => live && setStats(toStudioStats(s)),
        () => {}
      );
      void backend.me.recents().then(
        (r) => {
          if (!live) return;
          absorb(r.items.map((i) => i.track).filter((t): t is Track => t !== null));
          setRecents(toStudioHistory(r.items, Date.now()));
        },
        () => {}
      );
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser]);
```

- [ ] **Step 4: Make a like land immediately**

Still in `StudioProvider.tsx`, replace `toggleLike`:

```tsx
  const toggleLike = useCallback(
    (trackId: string) => {
      const wasLiked = likedIds.has(trackId);
      setLikedIds((s) => {
        const n = new Set(s);
        if (wasLiked) n.delete(trackId);
        else n.add(trackId);
        return n;
      });
      // The playlist moves on the click too, not after the round-trip — a like
      // that takes a network hop to appear in Liked Songs reads as a no-op.
      setCollections((cs) =>
        cs.map((c) =>
          c.id === LIKED_ID
            ? {
                ...c,
                trackIds: wasLiked
                  ? c.trackIds.filter((id) => id !== trackId)
                  : [trackId, ...c.trackIds],
              }
            : c
        )
      );
      void backend.me.setTrackState(trackId, { isLiked: !wasLiked }).then(refreshLibrary);
    },
    [backend, likedIds, refreshLibrary]
  );
```

- [ ] **Step 5: Mark the fixture Liked Songs as system too**

In `apps/web/components/studio/screens/mock-data.ts`, add `system: true` to the `LIKED_SONGS` literal so both providers agree.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/studio/StudioProvider.test.tsx --reporter=verbose`
Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/studio/StudioProvider.tsx apps/web/components/studio/StudioProvider.test.tsx apps/web/components/studio/screens/mock-data.ts
git commit -m "fix(library): always give every user a Liked Songs playlist"
```

---

## Task 14: `/api/me/likes` works without the blocked index

**Files:**
- Modify: `apps/web/app/api/me/likes/route.ts`
- Test: `apps/web/app/api/me/likes/route.test.ts` (create)

**Background:** the route runs `.where("isLiked","==",true).orderBy("likedAt","desc")`, which needs the composite index in `firestore.indexes.json` that is currently blocked from deployment. Firestore answers `FAILED_PRECONDITION`. The bare `where` needs only the single-field index Firestore creates automatically, so sorting in memory makes the endpoint correct today. The composite index stays in the repo — it remains the right answer at scale.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/api/me/likes/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { db, uid } = vi.hoisted(() => ({
  db: { orderedFails: false, docs: [] as { id: string; likedAt: number }[] },
  uid: { value: "u1" as string | null },
}));

vi.mock("@/lib/firebase/verify", () => ({
  uidFromRequest: async () => uid.value,
  unauthorized: () => new Response("no", { status: 401 }),
}));

vi.mock("@/lib/firebase/admin", () => {
  /** Minimal Firestore stand-in: the ordered query can be made to fail the
   *  way a missing composite index actually fails. */
  function makeQuery(ordered: boolean) {
    return {
      where: () => makeQuery(ordered),
      orderBy: () => makeQuery(true),
      get: async () => {
        if (ordered && db.orderedFails) {
          const e = new Error("The query requires an index.") as Error & { code: number };
          e.code = 9; // FAILED_PRECONDITION
          throw e;
        }
        return { docs: db.docs.map((d) => ({ id: d.id, data: () => d })) };
      },
    };
  }
  return {
    adminDb: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          collection: () => makeQuery(false),
          get: async () =>
            name === "tracks"
              ? { exists: true, data: () => ({ trackId: id, durationSec: 100 }) }
              : { exists: false, data: () => null },
        }),
        ...makeQuery(false),
      }),
    }),
  };
});

import { GET } from "./route";

describe("GET /api/me/likes", () => {
  beforeEach(() => {
    uid.value = "u1";
    db.orderedFails = false;
    db.docs = [
      { id: "t-old", likedAt: 1000 },
      { id: "t-new", likedAt: 3000 },
      { id: "t-mid", likedAt: 2000 },
    ];
  });

  it("returns the caller's liked tracks newest first", async () => {
    const res = await GET(new Request("http://x/api/me/likes"));
    const body = await res.json();
    expect(body.trackIds).toEqual(["t-new", "t-mid", "t-old"]);
  });

  it("falls back to an in-memory sort when the composite index is missing", async () => {
    // The index this query needs is not deployed. Without the fallback the
    // route 500s, which takes the whole library down in the provider.
    db.orderedFails = true;

    const res = await GET(new Request("http://x/api/me/likes"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackIds).toEqual(["t-new", "t-mid", "t-old"]);
  });

  it("401s an anonymous caller", async () => {
    uid.value = null;
    expect((await GET(new Request("http://x/api/me/likes"))).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/me/likes/route.test.ts --reporter=verbose`
Expected: FAIL — the fallback case throws instead of returning 200.

- [ ] **Step 3: Write the implementation**

Replace the body of `apps/web/app/api/me/likes/route.ts`:

```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { LIKED_COLLECTION_ID, type Track } from "@/lib/catalog/model";

export const runtime = "nodejs";

/** Firestore's gRPC status for "this query needs an index that doesn't exist". */
const FAILED_PRECONDITION = 9;

function isMissingIndex(err: unknown): boolean {
  const e = err as { code?: number; message?: string };
  return e?.code === FAILED_PRECONDITION || /requires an index/i.test(e?.message ?? "");
}

type LikedDoc = { id: string; likedAt: number };

function likedAtOf(data: unknown): number {
  const v = (data as { likedAt?: { toMillis?: () => number } | number })?.likedAt;
  if (typeof v === "number") return v;
  return typeof v?.toMillis === "function" ? v.toMillis() : 0;
}

/**
 * Liked Songs is virtual (spec D8): assembled from users/{uid}/trackState where
 * isLiked, newest-first, resolved against tracks/. There is no stored
 * collections/liked document, so likes have exactly one source of truth.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const trackState = db.collection("users").doc(uid).collection("trackState");
  const liked = trackState.where("isLiked", "==", true);

  let docs: LikedDoc[];
  try {
    const snap = await liked.orderBy("likedAt", "desc").get();
    docs = snap.docs.map((d) => ({ id: d.id, likedAt: likedAtOf(d.data()) }));
  } catch (err) {
    if (!isMissingIndex(err)) throw err;
    // The composite index is not deployed yet. The bare equality query needs
    // only the automatic single-field index, so sort in memory instead —
    // failing here 500s the endpoint, and the client treats that as "no
    // library at all". A user's like count is small enough for this to be fine.
    const snap = await liked.get();
    docs = snap.docs
      .map((d) => ({ id: d.id, likedAt: likedAtOf(d.data()) }))
      .sort((a, b) => b.likedAt - a.likedAt);
  }

  const trackIds = docs.map((d) => d.id);
  const tracks: Track[] = [];
  let totalDurationSec = 0;
  for (const id of trackIds) {
    const ts = await db.collection("tracks").doc(id).get();
    if (ts.exists) {
      const t = ts.data() as Track;
      tracks.push(t);
      totalDurationSec += t.durationSec ?? 0;
    }
  }

  return Response.json({
    collectionId: LIKED_COLLECTION_ID,
    title: "Liked Songs",
    virtual: true,
    trackIds,
    tracks,
    stats: { trackCount: trackIds.length, totalDurationSec },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/me/likes/route.test.ts --reporter=verbose`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/me/likes/route.ts apps/web/app/api/me/likes/route.test.ts
git commit -m "fix(api): serve Liked Songs without the undeployed composite index"
```

---

## Task 15: Liked Songs is permanent

**Files:**
- Modify: `apps/web/components/studio/screens/library-utils.ts`
- Modify: `apps/web/components/studio/screens/CollectionMenu.tsx`
- Modify: `apps/web/components/studio/screens/MockStudioProvider.tsx` (`togglePin`)
- Modify: `apps/web/components/studio/StudioProvider.tsx` (`togglePin`)
- Test: `apps/web/components/studio/screens/library-utils.test.ts`, `CollectionMenu.test.tsx` (both exist — add cases)

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/components/studio/screens/library-utils.test.ts`:

```ts
it("sorts a system collection ahead of pinned ones", () => {
  const liked = { ...LIKED_SONGS, system: true, pinned: true };
  const pinned = { ...MOCK_COLLECTIONS[0], pinned: true };
  const plain = { ...MOCK_COLLECTIONS[1], pinned: false };

  const out = filterLibrary([plain, pinned, liked], "playlists");
  expect(out[0].id).toBe(liked.id);
});
```

Append to `apps/web/components/studio/screens/CollectionMenu.test.tsx`:

```tsx
it("offers no pin or unpin for a system collection", async () => {
  // Liked Songs is permanent: there is no state in which unpinning it is a
  // thing the user can mean.
  render(
    <MockStudioProvider>
      <CollectionMenu collection={{ ...LIKED_SONGS, system: true }} />
    </MockStudioProvider>
  );
  fireEvent.click(screen.getByLabelText(`More for ${LIKED_SONGS.title}`));
  expect(await screen.findByText("Share")).toBeInTheDocument();
  expect(screen.queryByText("Unpin")).toBeNull();
  expect(screen.queryByText("Pin to top")).toBeNull();
});

it("still offers pin for an ordinary collection", async () => {
  render(
    <MockStudioProvider>
      <CollectionMenu collection={MOCK_COLLECTIONS[0]} />
    </MockStudioProvider>
  );
  fireEvent.click(screen.getByLabelText(`More for ${MOCK_COLLECTIONS[0].title}`));
  expect(await screen.findByText("Pin to top")).toBeInTheDocument();
});
```

Ensure both files import `LIKED_SONGS` and `MOCK_COLLECTIONS` from `./mock-data`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/screens/library-utils.test.ts components/studio/screens/CollectionMenu.test.tsx --reporter=verbose`
Expected: FAIL — "Unpin" is present; the sort puts the pinned collection first.

- [ ] **Step 3: Sort system collections first**

In `apps/web/components/studio/screens/library-utils.ts`, replace `filterLibrary`'s sort:

```ts
/** System first (Liked Songs), then pinned, then the chip's slice. Stable. */
export function filterLibrary(
  collections: MockCollection[],
  filter: LibraryFilter
): MockCollection[] {
  const rank = (c: MockCollection) => (c.system ? 2 : c.pinned ? 1 : 0);
  const ordered = [...collections].sort((a, b) => rank(b) - rank(a));
  if (filter === "liked") return ordered.filter((c) => c.id === LIKED_SONGS_ID);
  if (filter === "podcasts") return ordered.filter((c) => c.kind === "podcast");
  return ordered.filter((c) => c.kind === "music");
}
```

- [ ] **Step 4: Hide pin on a system collection**

In `apps/web/components/studio/screens/CollectionMenu.tsx`, wrap the pin item and its separator:

```tsx
          {/* A system collection (Liked Songs) is permanent: it cannot be
              unpinned or removed, so offering the control would be a lie
              about what the click does. Share still applies. */}
          {collection.system ? null : (
            <>
              <DropdownMenuItem
                onClick={() => {
                  togglePin(collection.id);
                  toast(pinned ? "Unpinned" : "Pinned to the top");
                }}
              >
                {pinned ? (
                  <DrawingPinFilledIcon className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <DrawingPinIcon className="mr-2 h-3.5 w-3.5" />
                )}
                {pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
```

- [ ] **Step 5: Make `togglePin` refuse it in both providers**

In `apps/web/components/studio/screens/MockStudioProvider.tsx`, replace `togglePin`:

```tsx
  const togglePin = useCallback((id: string) => {
    // Belt and braces with CollectionMenu hiding the control: nothing else
    // may unpin a permanent collection either.
    if (id === LIKED_SONGS_ID) return;
    setCollections((cs) =>
      cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);
```

In `apps/web/components/studio/StudioProvider.tsx`, add the same guard as the first line of `togglePin`:

```tsx
      if (id === LIKED_ID) return;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/studio/screens/library-utils.test.ts components/studio/screens/CollectionMenu.test.tsx --reporter=verbose`
Expected: PASS.

- [ ] **Step 7: Full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green. Part 3 is complete.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/studio/screens/library-utils.ts apps/web/components/studio/screens/library-utils.test.ts apps/web/components/studio/screens/CollectionMenu.tsx apps/web/components/studio/screens/CollectionMenu.test.tsx apps/web/components/studio/screens/MockStudioProvider.tsx apps/web/components/studio/StudioProvider.tsx
git commit -m "feat(library): make Liked Songs a permanent, always-first playlist"
```

---

# PART 4 — THE ADD FLOW (Spec §F, §G) AND FIRST RUN (Spec §C)

## Task 16: The rail's add card

**Files:**
- Modify: `apps/web/components/studio/shell/NowPlayingRail.tsx` (the `AddMusicSection` function)
- Test: `apps/web/components/studio/shell/NowPlayingRail.test.tsx`

The rail's permanently-open search field becomes a card with a `+`. The destination follows **the route** — what the user is looking at — not `playingCollection`. A user reading a playlist while something else plays means to add to the playlist in front of them.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/components/studio/shell/NowPlayingRail.test.tsx`:

```tsx
describe("add card", () => {
  it("targets the queue when no playlist is open", () => {
    nav.pathname = "/home";
    render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Add music to your queue")).toHaveAttribute(
      "href",
      "/queue/add"
    );
    expect(screen.getByText("to your queue")).toBeInTheDocument();
  });

  it("targets the open playlist when one is open", () => {
    // The control follows what the user is LOOKING at, not what happens to be
    // playing behind them.
    nav.pathname = `/playlist/${MOCK_COLLECTIONS[0].id}`;
    render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );
    expect(
      screen.getByLabelText(`Add music to ${MOCK_COLLECTIONS[0].title}`)
    ).toHaveAttribute("href", `/playlist/${MOCK_COLLECTIONS[0].id}/add`);
  });

  it("targets the queue on the queue's own add screen", () => {
    nav.pathname = "/queue/add";
    render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Add music to your queue")).toBeInTheDocument();
  });

  it("no longer embeds a search field in the rail", () => {
    nav.pathname = "/home";
    render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Search tracks to queue")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/studio/shell/NowPlayingRail.test.tsx --reporter=verbose`
Expected: FAIL — no such link; the search field is still present.

- [ ] **Step 3: Write the implementation**

In `apps/web/components/studio/shell/NowPlayingRail.tsx`, replace `AddMusicSection` and update the imports.

Imports to add:

```tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusIcon } from "@radix-ui/react-icons";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { addMusicHref, QUEUE, QUEUE_ADD } from "./routes";
```

Remove the now-unused `AddMusicPanel` import.

```tsx
/**
 * Where the "+" goes, read from the route rather than from playback state.
 *
 * The control must follow what the user is LOOKING at: someone reading a
 * playlist while something else plays means to add to the playlist in front of
 * them, not to the queue running behind it. Everywhere else — home, search,
 * profile, the queue itself — the queue is the only sensible destination.
 */
function useAddTarget(): { href: string; label: string } {
  const pathname = usePathname();
  const { collections } = useMockStudio();

  const match = pathname?.match(/^\/playlist\/([^/]+)/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const open = collections.find((c) => c.id === id);
    if (open) return { href: addMusicHref(open.id), label: open.title };
  }
  return { href: QUEUE_ADD, label: "your queue" };
}

/**
 * Add music — to the playlist on screen, or to the running queue.
 *
 * A card with one control, not a live search field. The rail is 340px and the
 * field it replaced pushed the queue preview off-screen while offering a
 * cramped result list; the add screens have the room to do it properly.
 */
function AddMusicSection() {
  const { href, label } = useAddTarget();

  return (
    <section
      aria-labelledby="add-to-queue-label"
      className="px-4 pt-5 pb-4 shrink-0"
    >
      <SectionLabel id="add-to-queue-label" className="block mb-2">
        Add music
      </SectionLabel>
      <Link
        href={href}
        aria-label={`Add music to ${label}`}
        data-signal="add_music_open"
        className={
          "group flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3 " +
          "hover:bg-secondary hover:border-primary/40 transition-colors duration-base " +
          "outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        }
      >
        <span className="min-w-0 flex-1">
          <span className="block font-ui font-medium text-sm truncate">
            Add music
          </span>
          {/* Names the destination outright — a "+" that could mean either the
              queue or a playlist is a "+" nobody trusts. */}
          <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate mt-0.5">
            to {label}
          </span>
        </span>
        <span
          aria-hidden
          className={
            "shrink-0 grid place-items-center w-9 h-9 rounded-full bg-primary text-primary-foreground " +
            "group-hover:scale-105 transition-transform duration-base"
          }
        >
          <PlusIcon />
        </span>
      </Link>
    </section>
  );
}
```

Keep the `QUEUE` import — `UpNextSection` still uses it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/studio/shell/NowPlayingRail.test.tsx --reporter=verbose`
Expected: PASS. Pre-existing cases asserting a live field in the rail (e.g. "offers a live field on a route with no playlist open") now describe removed behaviour — replace each with the equivalent assertion about the card's target, keeping the original intent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/shell/NowPlayingRail.tsx apps/web/components/studio/shell/NowPlayingRail.test.tsx
git commit -m "feat(rail): replace the inline add field with a card targeting the open playlist or queue"
```

---

## Task 17: Skeletons while the add search runs

**Files:**
- Modify: `apps/web/components/studio/screens/AddMusicPanel.tsx`
- Modify: `apps/web/app/(studio)/playlist/[id]/add/page.tsx`
- Test: `apps/web/components/studio/screens/AddMusicPanel.test.tsx` (exists — add a case)

- [ ] **Step 1: Write the failing test**

Append to `apps/web/components/studio/screens/AddMusicPanel.test.tsx`:

```tsx
it("shows skeleton rows while a search is in flight", async () => {
  // "No matches" during a request in flight is an answer to a question that
  // was never asked; a skeleton is a promise that content is coming.
  render(
    <MockStudioProvider>
      <AddMusicPanel />
    </MockStudioProvider>
  );

  fireEvent.change(screen.getByLabelText("Search tracks to queue"), {
    target: { value: "mid" },
  });

  const list = await screen.findByLabelText("Searching");
  expect(list).toBeInTheDocument();
  expect(screen.queryByText("No matches")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/studio/screens/AddMusicPanel.test.tsx --reporter=verbose`
Expected: FAIL — no element labelled "Searching".

- [ ] **Step 3: Write the implementation**

In `apps/web/components/studio/screens/AddMusicPanel.tsx`, add the import:

```tsx
import { SkeletonRow } from "@/components/studio/Skeletons";
```

Replace the searching branch:

```tsx
      ) : searching ? (
        // Not an EmptyState: "no matches" and "still looking" are different
        // answers, and showing the former while a request is in flight reads
        // as a result the search never gave. Skeleton rows shaped like the
        // TrackRows that are about to land.
        <div className="space-y-1" role="status" aria-label="Searching">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : results.length === 0 ? (
```

- [ ] **Step 4: Give the playlist add screen the same sub-line treatment**

In `apps/web/app/(studio)/playlist/[id]/add/page.tsx`, replace the `BackHeader` title so the two add screens read as siblings:

```tsx
        <BackHeader title="Search songs" backHref={playlistHref(collection.id)} />
```

Leave the existing `to {collection.title}` sub-line as it is.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/studio/screens/AddMusicPanel.test.tsx "app/(studio)/playlist" --reporter=verbose`
Expected: PASS. If a playlist-add test asserts the old "Add music" heading, update it to "Search songs".

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/screens/AddMusicPanel.tsx apps/web/components/studio/screens/AddMusicPanel.test.tsx "apps/web/app/(studio)/playlist/[id]/add/page.tsx"
git commit -m "feat(add): show skeleton rows while searching and match the two add screens"
```

---

## Task 18: First run lands on the queue

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const { replace, backend, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  backend: { me: { playback: { get: vi.fn() } } },
  authState: { user: null as { uid: string } | null },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/studio/useBackend", () => ({ useBackend: () => backend }));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));

import RootPage from "./page";

describe("root landing gate", () => {
  beforeEach(() => {
    replace.mockClear();
    authState.user = { uid: "u1" };
    backend.me.playback.get.mockResolvedValue({ queue: [], trackId: null });
  });

  it("sends a signed-out visitor to home", async () => {
    authState.user = null;
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("sends a brand-new account to the queue", async () => {
    // Nothing queued and nothing ever played: the first useful thing this user
    // can do is add music to what will play.
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/queue"));
  });

  it("sends a returning listener to home", async () => {
    backend.me.playback.get.mockResolvedValue({ queue: ["t1"], trackId: "t1" });
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("sends a listener with a saved track but an empty queue to home", async () => {
    backend.me.playback.get.mockResolvedValue({ queue: [], trackId: "t1" });
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("falls back to home when the playback read fails", async () => {
    // A network error must not redefine where the app opens.
    backend.me.playback.get.mockRejectedValue(new Error("offline"));
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/page.test.tsx --reporter=verbose`
Expected: FAIL — the current page calls the server `redirect()` and never `replace`.

- [ ] **Step 3: Write the implementation**

Replace `apps/web/app/page.tsx` entirely:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthState } from "@/lib/studio/useAuth";
import { useBackend } from "@/lib/studio/useBackend";
import { HOME, QUEUE } from "@/components/studio/shell/routes";

/**
 * The app root is the player. Where it opens depends on whether this user has
 * ever listened to anything.
 *
 * A brand-new account lands on the queue: it is empty, its "+" is the one
 * control that does something useful on a cold account, and sending them to
 * Home instead offers rails that have nothing personal in them yet. Anyone
 * with a queue or a saved track goes to Home, which is what they expect.
 *
 * Client-side because that decision needs the user's playback document, which
 * a server redirect cannot read without their token.
 */
export default function RootPage() {
  const router = useRouter();
  const { user } = useAuthState();
  const backend = useBackend();

  useEffect(() => {
    let live = true;

    // Signed out there is no history by definition, and the queue screen would
    // only offer a disabled field.
    if (!user) {
      router.replace(HOME);
      return;
    }

    void backend.me.playback.get().then(
      (state) => {
        if (!live) return;
        const cold = !state?.trackId && (state?.queue?.length ?? 0) === 0;
        router.replace(cold ? QUEUE : HOME);
      },
      () => {
        // A failed read must not redefine where the app opens.
        if (live) router.replace(HOME);
      }
    );

    return () => {
      live = false;
    };
  }, [user, backend, router]);

  // The shell's own loading state covers the decision, so there is no flash of
  // a page the user is about to be moved off.
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/page.test.tsx --reporter=verbose`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/page.test.tsx
git commit -m "feat(app): open a brand-new account on the queue instead of home"
```

---

## Task 19: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. `<img>` warnings are suppressed at the two sites that use it.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: all pass, no unhandled rejections.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds; `/queue/add` appears in the route list.

- [ ] **Step 5: Verify in the browser**

Start the dev server via the preview tooling (never `npm run dev` in a shell) and confirm each report against the running app:

1. Track rows, cards and the vinyl show real thumbnails — not generated textures.
2. `/queue` → `+` opens the add screen; it never says "Collection not found".
3. Adding from that screen puts the track in Up next and in no playlist.
4. Queue two tracks, click a row in the rail's Up next — nothing else disappears.
5. Queue the same track twice — both rows stay put.
6. `⋯` on a queue row → "Remove from queue" removes only that copy.
7. Liked Songs is in the library, first, with no unpin in its `⋯`.
8. Liking a track puts it in Liked Songs immediately.
9. The rail's add card says "to your queue" on `/home` and "to <playlist>" on a playlist route.
10. A fresh account opens on `/queue`.

- [ ] **Step 6: Final commit if anything was touched**

```bash
git status
```

If clean, the work is done. Do not push to `main` — this branch is `v2_2026`.

---

## Self-Review Notes

**Spec coverage:** §A → Tasks 1–7. §B → Task 8. §C → Task 18. §D1 → Task 9. §D2, §D3 → Tasks 10, 12. §D `dequeue` → Tasks 9, 11. §E → Tasks 13, 14, 15. §F → Task 16. §G → Tasks 8, 17.

**Deviation from the spec, deliberate:** the spec proposed changing `useQueueCollection` to return `{ collection, tracks }`. The plan leaves that hook's signature alone and instead has queue surfaces read `queue`/`currentIndex` from the context they already consume. Same outcome — no registry round-trip — without breaking the hook's three existing tests for no gain.

**Contract changes** (must land in both providers, Task 9): `currentIndex`, `playAt`, `dequeue`.

**Cross-task dependency:** Task 10 passes `queueIndex` to `TrackMenu`, which Task 11 adds. `tsc` is red between them by design; Task 11 Step 5 closes it.
