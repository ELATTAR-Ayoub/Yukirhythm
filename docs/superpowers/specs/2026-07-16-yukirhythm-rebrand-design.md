# Yukirhythm Rebrand & UI Redesign — Design Spec

Date: 2026-07-16 · Branch: `v2-design-studio` · Status: approved by owner in brainstorming session

## 1. Brand

- **Palette — "Studio" (locked by owner):**
  - `#191919` Ink — text on light, dark surfaces
  - `#1450F0` Cobalt — primary actions, links, focus
  - `#7DF08A` Mint — success, now-playing, highlights
  - `#F7F6F3` Paper — light surfaces, text on dark
  - Usage ratio ≈ 60% paper / 30% ink / 10% cobalt+mint. Derived tints/shades allowed as alpha variants of the four bases only.
- **Audience:** young generation (~under 25) first, built for everyone. Futuristic, digital-native.
- **Visual language:** dithered/ASCII textures (asset pack), pixel-grade data displays, generous paper space, ink shadows.
- **Data rule:** all numeric data (timestamps, BPM, durations, counters) renders in the Data font — the "digital" personality the owner chose.

## 2. Typography

| Role | Font | Usage |
|---|---|---|
| Display | Space Grotesk | wordmark, page titles, track titles, hero cards |
| Interface | Inter | buttons, nav, body, settings |
| Labels | IBM Plex Mono | section labels, catalogue tags, uppercase letter-spaced |
| Data | Doto (primary) / VT323 (alt) | timestamps, BPM, stats — dot-matrix LCD feel |
| CJK fallback | Noto Sans JP | appended to every stack; library is full of JP/CN titles |

Working choice — swappable via tokens; owner may override. Type scale: display/h1/h2/h3/body/small/caption with fixed size, weight, line-height, letter-spacing (defined in `/design-system`).

## 3. Sitemap (approved)

1. **`/` Home** — greeting, badge switcher (All/Music/Podcasts), recently played rail, Music-of-the-Week hero, new releases, "you might like", discovery shelves ("because you liked X", moods). Discover page merged into Home per owner.
2. **`/player` — flagship page.** Large dithered artwork, display-type title, mono artist, transport, data-font progress, queue peek, like/add, ambient texture background, agent presence.
3. **`/search`** — empty: trending + recommendations + genre tiles; typing: "did you mean" popup with one-tap add.
4. **`/library`** — tabs: Liked · Playlists · History.
5. **`/profile`** — account + listening dashboard (hours, top artists/genres, taste map, streaks).
6. **`/design-system`** — foundations + agent-states gallery + texture library.
7. **`/design-system/components`** — live component inventory: variants × states + emitted data signal per component.

**Agent companion** (all pages): floating `<yuki-agent>` orb above the player bar reflecting app state; expands to side-panel chat with playable/addable result cards. Owner-supplied web component (19 states, Studio palette, dithered canvas).

## 4. Assets (owner-supplied)

- `yuki-agent-pack/yuki-agent.js` — custom element, 19 states: idle(+b), listening, thinking, responding, done(+b), searching, downloading, playing, scanning, playlist(+b), syncing, recommending(+b), asking(+b), success(+b), error(+b), sleeping(+b). Goes to `apps/web/public/` + React wrapper.
- 23 dithered/ASCII textures → `apps/web/public/textures/` — placeholder covers, page backgrounds, empty states.

## 5. Component inventory

**Existing kept & restyled:** shadcn primitives (button, input, card, badge, tabs, slider, avatar, label, form, dialog, alert-dialog, drawer, dropdown-menu, sonner, aurora-background), Logo, Header, Loader, SolidSVG, player controls, UserAudioList, UserCollectionsList, ListDrawer, forms.

**New:** theme tokens; DisplayText/UIText/DataText; Texture; YukiAgent wrapper; MediaCard (S/M/L × boxy/extended); HeroCard; RailShelf; BadgeSwitcher; NowPlayingBar; FullPlayer (ArtworkDisplay, TransportControls, ProgressBar, VolumeControl, QueuePeek, LikeButton); EqIndicator; SearchBar + DidYouMeanPopup; GenreTile; TrendingList; AgentOrb; AgentPanel + AgentResultCard; TrackRow; PlaylistGrid + CreatePlaylistCard; StatsDashboard (TopArtistsList, TasteMap); AccountCard; EmptyState; SkeletonCard/SkeletonRow; PageHeader; SectionLabel; SpecimenBlock; TokenSwatch; ComponentDemo; AgentStatesGallery; TextureLibrary.

## 6. Data-signal philosophy

Backend focus is user-signal gathering for recommendations. Every interactive component documents and emits a signal: badge switches, card hover-vs-play, skips <10s, did-you-mean accept/reject, agent queries, dashboard visits. `/design-system/components` lists the signal next to each component.

## 7. Build order

design-system foundations → components inventory → Player → Home → Search → Library → Profile → Agent panel.

## 8. Testing

Vitest baseline stays green; new pure logic (token maps, card-size logic, signal emitters) gets unit tests; pages verified visually against this spec via the dev server.

## 9. Out of scope (this branch)

Backend/recommendation algorithm, podcast content pipeline, auth changes, the other agent's concurrent work on `v2_2026`.
