# Yukirhythm Studio Design System — Usage Spec

Branch: `v2-design-studio` · Live reference: `/design-system` (Foundations · Typography · Colors · Space & Motion · Components)

This is the operating manual. Any agent or developer building UI for Yukirhythm follows these rules — the design-system pages are the living proof of each one.

---

## 1. Hard rules (non-negotiable)

1. **Two fonts only.** Satoshi = every word. OffBit = numbers only (`type-data-*`). The single worded OffBit exception is the "Yuki Rhythm" wordmark (`type-pixel-title`). Noto Sans JP exists only as an invisible CJK fallback — never name it in a design.
2. **Never call `#F7F6F3` "paper".** It is **Snow**.
3. **One color scale.** Ink (`ink-50…950`, snow at 50 → ink at 950) is the base of everything. Cobalt and Mint have exactly 3 shades each (`-soft`, default, `-deep`). Red exists only as the `destructive` token — deletes and errors, never decoration.
4. **Multi-icon controls use `IconSwap`.** Any control that alternates icons (play/pause/wait, mute, like, expand) swaps them through the directional vertical strip. No crossfades, no instant swaps.
5. **Content bounces; controls click.** Springy motion for things that appear/react/reward; machine motion for things you operate.
6. **All numbers render in the data font** (`type-data-*` / `font-data`) — timestamps, BPM, counters, durations.

## 2. Tokens

### Color (CSS vars, shadcn-compatible, light+dark automatic)
`--background --foreground --card --popover --primary --secondary --muted --muted-foreground --accent --border --input --ring --destructive`
Tailwind extras: `ink` (+`ink-50…950`), `cobalt`/`cobalt-soft`/`cobalt-deep`, `mint`/`mint-soft`/`mint-deep`, `snow`.
Usage ratio ≈ 60% snow / 30% ink / 10% cobalt+mint.

### Elevation (realistic: contact + ambient falloff; theme-aware)
- `shadow-e1` resting rows/chips · `shadow-e2` cards · `shadow-e3` floating (player bar, popovers) · `shadow-e4` overhead (dialogs, agent panel)
- Machine surfaces: `shadow-key` (raised key w/ side wall) · `shadow-key-down` (pressed key) · `shadow-pressed` (sunken socket) · `shadow-btn` / `shadow-btn-primary` / `shadow-btn-down` (control depth) · `shadow-chip` (badge depth)
- `.main_shadow`, `.disc_shadow`, `.AudioCard`, `.player_shadow` — owner's original surfaces, token-driven, kept.

### Motion
- Durations: `duration-tick` 80ms (machine) · `duration-fast` 150 · `duration-base` 250 · `duration-slow` 400
- Easing: `ease-spring` = cubic-bezier(.34,1.56,.64,1) (overshoot+settle) · `--ease-out` · `--ease-mech` steps
- Global classes: **`.click-spring`** (THE press feel — put on anything clickable) · `.press-spring` · `.press-key` (machine key travel) · `.anim-pop-in` (jelly pop from 25%, never 0) · `.anim-spring-up` (soft rise) · `.anim-jelly` (squash-stretch reward) · `.anim-ratchet` (steps(8) mechanical spin) · `.anim-sign-on` (neon text power-up — TEXT only) · `.anim-disc-install`

### Spacing / radius
4px grid: `space-1…16` (4/8/12/16/24/32/48/64). Radius: `rounded-sm` 12 (chips, inputs) · `rounded-md` 14 (buttons, rows) · `rounded-lg` 16 (cards, panels). If a gap isn't on the scale, it's wrong.

## 3. Typography classes (globals.css)

Satoshi: `.type-display .type-h1 .type-h2 .type-h3 .type-h4 .type-lead .type-p .type-large .type-small .type-muted .type-blockquote .type-label .type-code`
OffBit: `.type-pixel-title` (wordmark only) · `.type-data-sm` 12 / `.type-data` 16 / `.type-data-md` 20 / `.type-data-lg` 30 (numbers only)
Use the class — never hand-rolled sizes.

## 4. Components (all in `apps/web/components/`)

### Button — `ui/button.tsx`
Variants: `default` (cobalt, primary action) · `secondary` (neumorphic `main_shadow` depth — the old "stylized", merged) · `outline` · `ghost` · `link` · `destructive`. Sizes: `default sm lg icon smallIcon`.
Physics built in: spring press (80ms squish → 250ms overshoot release), hover lift, pressed sinks to `shadow-btn-down`.

### PlayerButton — `studio/PlayerButton.tsx`
Round transport control. Variants: `primary` (cobalt — the play key) · `secondary` (default, neumorphic) · `outline` · `ghost`. Sizes: `sm` 28 · `base` 32 (canonical) · `lg` 44 · `xl` 56 — icon auto-sizes. Props: `loading` (spinner replaces icon + disables), `active` (pressed toggles — ring + sunken; for LOOP make the variant `primary` while active), `disabled`.
Exports `CircleSpinner` — the ONLY wait icon.

### IconSwap — `studio/IconSwap.tsx` (RULE #4)
`<IconSwap active="pause" icons={{ play: <PlayIcon/>, pause: <PauseIcon/>, wait: <CircleSpinner/> }} />`
Icons form a physical strip in key order (first = top). Position = (index − activeIndex) × 160%. Advancing rolls the strip up; going back rolls down. Put it INSIDE a PlayerButton/Button as the child.
Canonical middle-button pattern (play/pause/wait):
`active={loading ? "wait" : playing ? "pause" : "play"}`

### Transport cluster (composition pattern)
Left→right: `outline` loop (becomes `variant="primary"` while looping) · `secondary` prev · `primary lg` play/pause/wait (3-face IconSwap) · `secondary` next · `outline` list/queue. Far ends always match variants.

### DiscDeck — `studio/DiscDeck.tsx` (+ `studio/deck/DeckScene.tsx`)
Real-3D (three.js/R3F) track carousel: frontal trio — center disc faces viewer, neighbours rotateY-tilted; stick-finger stylus from top-right. `tracks: { title, artist, texture?, artUrl? }[]`. Phases: `paused → playing → lifting → installing → playing`; spin has inertia; install seats with a real underdamped spring. Canvas is transparent; its stage div MUST carry `data-deck-stage` (escapes the legacy global `canvas { fixed }` rule in `styles/loader.css`). WebGL-blocked browsers get a fallback card. Status line vocabulary: `ON STANDBY / NOW SPINNING / LIFTING NEEDLE… / INSTALLING DISC…`.

### MediaCard — `studio/MediaCard.tsx`
`variant`: `boxy` (grid tile) | `extended` (full-width row). `size`: boxy `sm` dense rails / `md` standard grids / `lg` feature spots; extended `md` queue rows / `lg` hero rows. Props: `title artist texture|artUrl duration playing`. Signal: `card_play`, `card_open`.

### TrackRow — `studio/TrackRow.tsx`
List row (library/queue/history). Props: `index title artist duration texture|artUrl playing selected`. Playing shows EqIndicator + primary title. Signal: `row_play`, `row_queue`.

### RailShelf — `studio/RailShelf.tsx`
Horizontal shelf: `label` (type-label) + `title` (display) + optional `seeAllHref` (ghost Button + ArrowRightIcon — never a text arrow). `loading` prop skeletons EVERYTHING (header bars, see-all pill, 6 cards). Signals: `shelf_scroll`, `shelf_see_all`.

### BadgeSwitcher — `studio/BadgeSwitcher.tsx`
Page-scoping chips (All/Music/Podcasts…). Active chip = ink-on-snow (inverts in dark). `.click-spring` built in. Signal: `badge_switch`.

### Others
- `studio/EqIndicator.tsx` — playing bars, mint by default, `playing={false}` freezes; inherits currentColor.
- `studio/EmptyState.tsx` — texture tile + Satoshi uppercase title + hint + optional action.
- `studio/Skeletons.tsx` — `SkeletonCard`, `SkeletonRow`.
- `studio/Texture.tsx` — the 13 curated dithered textures (`tx-k-*`, `tx-k2-*`) from `public/textures/`; always `pixelated`. `TEXTURE_NAMES` is the whitelist.
- `studio/DataText.tsx`, `studio/SectionLabel.tsx` — data-font numbers / catalogue labels.
- `agent/YukiAgent.tsx` — dithered canvas companion, 17+ states (`idle listening thinking searching downloading playing recommending asking success error sleeping …`). Pass `class` sizing via the wrapper's `className`. Its canvas is already escaped from the legacy fixed rule.
- `ui/*` (shadcn, restyled): input (smooth focus ring, visible placeholder), badge (`shadow-chip` + click-spring), tabs (active pill slides between triggers with spring + jelly), slider (thumb springs on grab 1.35×, lingers 0.5s before hiding), avatar (click-spring), dialog, drawer, dropdown-menu, sonner, tabs.

## 5. Data signals

Every interactive component documents the signal it emits for the recommendation engine (shown per-panel on `/design-system/components`): `card_play card_open row_play row_queue shelf_scroll shelf_see_all badge_switch search_query tab_switch seek volume_change disc_next disc_prev play pause agent_open agent_query`. When building pages, wire these names — the backend gathers them.

## 6. Known traps

- `styles/loader.css` declares `canvas { position: fixed; z-index: -1 }` globally (for the old Spline background). ANY new canvas must be escaped like `yuki-agent canvas` / `[data-deck-stage] canvas` in `globals.css`.
- Tailwind `darkMode` must stay `["class"]` — `["class","class"]` silently kills every `dark:` variant.
- The app's letterSpacing scale is custom: `tracking-tighter` = literal −6px, `tightest` = −12px. Use `tracking-tight` (−.025em) for display text.
- Fonts load via `next/font/local` in `app/fonts.ts` → CSS vars `--font-sans --font-pixel --font-pixel-dot --font-jp`. Don't add Google display fonts.

## 7. Where things live

- Tokens/classes: `apps/web/app/globals.css` · `apps/web/tailwind.config.js`
- Fonts: `apps/web/app/fonts.ts` (+ `public/fonts/satoshi`, `public/fonts/offbit`)
- Color data: `apps/web/constants/studio-colors.ts`
- DS pages: `apps/web/app/design-system/**` (foundations hub, typography, colors, space, components)
- DS demo helpers: `apps/web/components/studio/ds/*` (StatePanel, MotionLab, ColorRamp, blocks, ThemeFlip, AgentGallery, IconSwapDemo)
