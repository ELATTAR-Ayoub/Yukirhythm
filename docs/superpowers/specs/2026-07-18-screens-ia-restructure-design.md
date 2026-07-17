# Screens IA Restructure — Design

**Date:** 2026-07-18
**Branch:** `v2-design-studio` (design-studio worktree)
**Scope:** Design-studio mock screens only (`/design-system/screens/*`). This is the flow blueprint the real app and backend work will target later. All data is mock; nothing hits the network.

## Goal

Reshape the mocked app from five standalone screens (home/player, profile, login, signup, credits) into a modern four-section app — Home, Search, Library, Profile — with one merged social-auth screen and a global two-state player. The Profile section is built to showcase rich listening-behavior data collection.

## Route map

```
/design-system/screens/
├── auth                 ← merged login+signup (replaces login/ and signup/)
├── home                 ← recent collections row + new releases
├── search               ← search bar, results, you-might-like, explore, new releases
├── library              ← type chips, Liked Songs pinned, collections, create playlist
├── profile              ← hub: profile badge + menu rows
│   ├── view             ← view profile (large avatar, name, joined date, headline stats)
│   ├── stats            ← listening statistics
│   ├── recents          ← recently played history
│   ├── settings         ← app/account settings
│   └── privacy          ← privacy controls
└── credits              ← untouched, stays as-is
```

- The old `login/` and `signup/` screen routes are deleted, replaced by `auth`.
- Drawers (playlist detail, create playlist) and the expanded player are in-page states, not routes.
- The screens index page (`/design-system/screens`) gets updated cards for the new set.

## Navigation & shell

A shared **AppShell** layout wraps `home`, `search`, `library`, and `profile/*`. `auth` and `credits` render outside the shell.

- **Mobile:** bottom tab bar with three tabs — Home, Search, Library. Profile is reached by tapping the avatar in the page header (no profile tab).
- **Desktop:** left sidebar (shadcn Sidebar, restyled to the brand): logo at top, Home/Search/Library items, and the user avatar pinned at the sidebar bottom — tapping it opens Profile.
- **PageHeader** (shared by Home, Search, Library, Profile hub): left — avatar + page title; right — contextual ghost icon buttons. The avatar opens the Profile hub; signed-out it shows a guest placeholder that leads to `auth`.
- Profile sub-screens are real sub-routes with a back affordance to the profile hub.

## Global player

The current device player becomes a global component mounted once in the shell, present on all four tabs (hidden on `auth`/`credits`), with two states:

- **Compressed:** a slim now-playing bar — track info on the left, prev/play/next on the right — sitting just above the mobile tab bar / at the bottom of the desktop content area. The page behind stays fully usable.
- **Expanded:** tapping the bar animates the full device player (disc, transport) into the center of the screen over the current page, with a spring animation. Collapsing returns to the page unchanged.

The earlier idea of a raised blue accent middle tab-bar button as the player trigger is explicitly dropped — the bar itself is the only trigger.

## Auth

One screen replaces login and signup. Firebase social sign-in creates the account on first login, so no separate flows and **no email forms**.

- Aurora background kept. Brand mark, short tagline, two social buttons (Continue with Google, Continue with Facebook), fine-print line.
- In the mock, tapping either button flips the mock session to signed-in and lands on Home.

## Guest browsing (signed-out)

- Home, Search, and playback fully work signed-out.
- Library and Profile render a **SignInPrompt** leading to `auth`.
- Home hides the recents row when signed out; Search works entirely.

## Per-screen specs

### Home
`PageHeader` (avatar, "Home", ghost buttons such as notifications). Top: **"Jump back in"** — a shelf of recently listened collections (cards; tap → playlist drawer). Below: **"New releases"** shelf. Signed-out: recents hidden, new releases shown.

### Search
`PageHeader` + prominent search input. Idle: **"You might like"** shelf (driven by mock listening behavior), **"Explore"** grid of genre/mood tiles, **"New releases"** shelf. Typing: live mock results — tracks and collections, playable immediately (guests included).

### Library
`PageHeader` (ghost button: create-playlist shortcut). Filter chip row: **Playlists / Podcasts / Liked Songs** (content-type filters — distinct from per-playlist tags). List: **Liked Songs pinned first** (everyone has it; pinned by default, special styling), then user-pinned playlists, then the rest. Bottom: **Create playlist** row.

**Playlist drawer** (~95vh, spring): back button (closes drawer), title, song count, play + shuffle buttons, the playlist's own tags, view toggle (rows ↔ grid; grid 3-across on mobile, expands responsively), sort control (recently added / alphabetical), add-to-this-playlist action, then the track list. Each track row has a menu (share, add to playlist, remove, etc.).

**Create playlist drawer** (~90–95vh): reuses the existing create-playlist flow, restyled to the brand.

Signed-out: `SignInPrompt`.

### Profile hub
`ProfileBadge` at top (tap → `profile/view` sub-screen: large avatar, name, joined date, headline listening stats). Below, menu rows: **Listening stats**, **Recents**, **Settings**, **Privacy**. Signed-out: `SignInPrompt`.

### Profile subpages
Each has a back-to-hub header. Fill them with everything useful — the product goal is collecting as much listening-behavior information as possible.

- **Stats:** minutes listened (week/month/all-time), top artists, top tracks, genre breakdown, listening-by-hour pattern, streaks. Stat cards + simple charts. The data-collection showcase.
- **Recents:** chronological history grouped (today / yesterday / this week), each row playable, with "played from X collection" context.
- **Settings:** mock rows — audio quality, language, appearance, account (connected Google/Facebook), sign out.
- **Privacy:** the consent story for the data appetite — toggles for listening-history collection, personalized recommendations, public profile visibility, and a clear-history action.

### Credits
Untouched. Remains a standalone screen outside the shell.

## Component inventory

Anything used more than once is a component. App-level mock-driven components live under `components/studio/`; primitives stay under `components/ui/` (shadcn). Categories below are also the gallery categories.

**Shell & Navigation**
- `AppShell` — wraps the four tab screens; slots for sidebar/tab bar + global player.
- `SideNav` — desktop sidebar (shadcn Sidebar restyled).
- `BottomTabBar` — mobile: Home, Search, Library.
- `PageHeader` — avatar + title left, ghost actions right.

**Player**
- `GlobalPlayer` — owns compressed/expanded state, mounted once in the shell.
- `MiniPlayerBar` — compressed bar.
- `ExpandedPlayer` — the current device player repackaged; reuses existing `Transport`.

**Content**
- `CollectionCard` — cover-art card (home recents, library grid, search results).
- `CollectionListRow` — list-row variant for library rows view.
- `TrackRow` — artwork, title, artist, duration + menu trigger.
- `TrackMenu` — dropdown: share, add to playlist, remove, etc.
- `ShelfRow` — titled horizontal scroller ("New releases", "You might like", "Explore").
- `TagChip` + `FilterChipRow` — library type chips and playlist tags.
- `ViewToggle` — rows ↔ grid.
- `SortControl` — recently added / alphabetical.

**Drawers**
- `AppDrawer` — the ~95vh spring/jelly drawer base (built on the existing shadcn drawer); used by all drawers.
- `PlaylistDrawer` — playlist detail contents.
- `CreatePlaylistDrawer` — existing create-playlist form, rebranded.

**Profile & States**
- `ProfileBadge` — avatar + name; opens view-profile.
- `MenuRow` / `MenuList` — hub rows (icon, label, chevron).
- `StatCard` — listening-stat tiles.
- `SocialAuthButtons` — Google + Facebook.
- `SignInPrompt` — guest gate for Library/Profile.
- `EmptyState` — generic empty visuals.

## Components gallery

`/design-system/components` becomes a **category index** — cards for Shell & Nav, Player, Content, Drawers, Profile & States, plus the existing primitives — each opening its own sub-page showing that category's components in all their states. No single page renders everything, so the gallery stays fast as the component count grows. Every new component in this design gets registered in its category page.

## Mock data & state

**`mock-data.ts` (extended):** collections (type `music | podcast`, tags, pinned flag, cover art), tracks (title, artist, duration, artwork), a Liked Songs collection every user has, listening-history entries (track + timestamp + source collection), derived stats (minutes, top artists/tracks, genre split, by-hour pattern, streaks). "New releases" and "You might like" are curated slices of the same dataset.

**`MockStudioProvider` (extended)** with three slices, all local:
- **session** — signed in/out; powers guest states everywhere.
- **player** — current track, playing, compressed/expanded; `GlobalPlayer` reads it, any play control writes it.
- **library** — collections, pins, active filter chip.

## Motion

One shared spring config (slight jelly overshoot) used consistently: drawers slide up with it, the expanded player scales/slides in with it, chips and tab transitions are fast and subtle. `prefers-reduced-motion` collapses all of it to simple fades.

## Error handling

Mock world — the failure surface is states, not errors. Every screen defines its empty state (empty library, no search results, no recents) via `EmptyState`, and its guest state via `SignInPrompt`.

## Testing

Follows the existing `MockStudioProvider.test.tsx` pattern:
- Provider tests for the new slices — auth flip, play/pause, pin/filter logic.
- Interaction tests for key flows — auth button signs in, chip filters the library, tapping a collection opens the drawer, mini-player expands/collapses.
- Visual polish verified in the browser preview.

## Out of scope

- Real routes (`apps/web/app/*`), backend, Firebase wiring — a later phase consumes this blueprint.
- The Credits screen.
- Real search, real recommendations, real stats — all mock.
