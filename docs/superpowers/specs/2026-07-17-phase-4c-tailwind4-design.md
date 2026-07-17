# Phase 4C — Tailwind 4 (Design)

**Date:** 2026-07-17
**Project:** Yukirhythm
**Branch:** `v2_2026`
**Risk:** 🟡 Medium — isolated to styling, but a bad token mapping means a **visibly broken app**

---

## Goal

Migrate Tailwind 3.2 → 4.x. **The app must look pixel-identical afterward.** This is a config/engine migration, not a redesign — the design refresh is Phase 6.

## Why this is riskier than it looks

Tailwind 4 is a ground-up rewrite: config moves from JS into CSS, the engine changed, and **deep imports into Tailwind internals are gone**. This project uses one.

---

## Reconnaissance (verified 2026-07-17)

### 🔴 The main blocker: a load-bearing plugin built on a deep internal import

`tailwind.config.js` ends with a custom plugin:
```js
const { default: flattenColorPalette } =
  require("tailwindcss/lib/util/flattenColorPalette");   // ← deep internal import

function addVariablesForColors({ addBase, theme }) {
  // exposes every theme color as a global CSS var: --blue-500, --gray-200, ...
}
```
**`tailwindcss/lib/util/flattenColorPalette` does not exist in Tailwind 4.** This will break immediately.

And it is **not dead code** — `components/ui/aurora-background.tsx:32` depends on the variables it generates:
```
[--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,
 var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)]
```
`AuroraBackground` renders on **three real pages**: `/credits`, `/login`, `/signup`.

**The fix is deletion, not a rewrite.** Tailwind 4 exposes every theme color as a CSS variable natively via `@theme` — but **under a different name**: `--blue-500` becomes **`--color-blue-500`**. So:
1. Delete the plugin and the `flattenColorPalette` import entirely.
2. Update `aurora-background.tsx:32` to use `var(--color-blue-500)` etc.
This is a **net simplification** — v4 gives us for free what the plugin existed to fake.

### What else is in play

| Item | Current | Tailwind 4 |
|---|---|---|
| Directives | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Config | `tailwind.config.js` (JS) | CSS-first via `@theme` |
| PostCSS | `{ tailwindcss: {}, autoprefixer: {} }` | `@tailwindcss/postcss`; **autoprefixer removed** (built in) |
| `tailwindcss-animate` | v3-era plugin | **`tw-animate-css`** |
| `darkMode: ["class","class"]` | JS option (note the odd duplicate) | `@custom-variant dark (&:is(.dark *))` |
| `content: [...]` globs | explicit | auto-detected; `@source` only if needed |

**Animation classes actually used** (must all still work): `animate-aurora` (custom keyframes), `animate-in` / `animate-out` (**from `tailwindcss-animate`** → needs `tw-animate-css`), `animate-pulse`, `animate-spin` (built-in).

**`letterSpacing` is an OVERRIDE, not an extend** — it replaces Tailwind's whole tracking scale with custom values (`tightest: -12px`, `tighter: -6px`, …). `tracking-tight` and `tracking-widest` are used in components. This must be preserved exactly, or spacing shifts visibly.

### 🐛 Bug found: a duplicate key silently discards a color

`tailwind.config.js` declares `popover` **twice** inside `theme.extend.colors`:
```js
popover: "#262626",                          // line 27  ← DEAD, silently overwritten
...
popover: { DEFAULT: "hsl(var(--popover))",   // line 35  ← wins
           foreground: "hsl(var(--popover-foreground))" },
```
JS object literals keep the last key, so `#262626` has never applied. **Pre-existing; not introduced here.** Resolve during migration by dropping the dead line — and **say so explicitly**, because if `#262626` was the intended popover color, removing it is a *fix* that changes nothing today but clarifies intent. Do not "restore" it — that would be a visual change.

### The token layer — the key design decision

`globals.css` uses classic **shadcn-v3 HSL triplets**:
```css
:root { --background: 0 0% 100%; --radius: 0.5rem; ... }
.dark { --background: 240 10% 3.9%; ... }
```
consumed via `hsl(var(--background))` in the config.

Upstream shadcn has since moved to `oklch` + `@theme inline`. **We are NOT doing that** — converting color spaces risks visible shifts and is a Phase 6 concern.

**Decision: keep the existing `:root`/`.dark` HSL triplets byte-for-byte**, and bridge them in CSS:
```css
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  /* ...one line per existing token... */
}
```
This preserves every computed color exactly while satisfying v4's CSS-first model. **Minimum visual risk is the whole point.**

---

## Work items

1. **Install:** `tailwindcss@4`, `@tailwindcss/postcss`, `tw-animate-css`. **Remove `autoprefixer`** (v4 includes it) and `tailwindcss-animate`.
2. **Run `npx @tailwindcss/upgrade`** — then **review its diff closely**. It will not understand the custom plugin; it is a starting point, not an authority.
3. **`postcss.config.js`** → `{ plugins: { "@tailwindcss/postcss": {} } }`.
4. **`globals.css`**: `@tailwind` → `@import "tailwindcss"` + `@import "tw-animate-css"`; add `@custom-variant dark`; port the theme into `@theme` / `@theme inline`; keep `:root`/`.dark` triplets untouched.
5. **Delete the custom plugin** + `flattenColorPalette` import; **update `aurora-background.tsx`** to `var(--color-*)`.
6. **Port the theme**: colors (via `@theme inline`), the `letterSpacing` override (`--tracking-*`), `animation`/`keyframes` aurora, `transitionTimingFunction.out-flex`, `fontFamily.PIXELADE`, `borderRadius` (`--radius`-derived). Drop the dead duplicate `popover`.
7. **Delete or reduce `tailwind.config.js`** once everything lives in CSS.

## Non-goals (explicitly deferred)

- **No design changes.** Pixel-identical is the bar. Phase 6 is the refresh.
- **No oklch/shadcn-v4 token migration** — Phase 6, deliberately.
- **No TypeScript change** (TS 7 remains blocked — CLI-only npm shim).
- **No Next/React/ESLint change** — 4B is done.
- **No firebase/zod/react-player** — 4D.
- **No `slice(0.2)` avatar fix, no React Compiler `warn` fixes** — both have their own tasks.

## Testing strategy

- **Gates after each step:** `lint`, `typecheck`, `test` (41), `build`. **CI green is the definition of done.**
- ⚠️ **Automated tests cannot catch this.** They assert structure, not appearance — every test could pass with the site looking wrecked. So:
- 🎯 **Visual verification is MANDATORY and is the real gate.** Capture the rendered pages **before** the migration and compare after: `/` (the disc/player), `/login`, `/signup`, `/credits` (all three use AuroraBackground), `/profile/[id]`, plus the list drawer open, **and both light and dark themes**.
- **Specifically verify:** the aurora gradient still renders (the `--color-*` rename), `animate-in`/`animate-out` still animate (drawer/dialog), `tracking-tight`/`tracking-widest` spacing, the PIXELADE font, and border radii.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **The `flattenColorPalette` plugin breaks the build** | Expected — delete it; v4 provides `--color-*` natively. Update aurora-background's 5 var references. |
| **The aurora gradient silently disappears** (vars renamed) | It's on 3 pages; explicitly in the visual checklist |
| `animate-in`/`animate-out` stop working | `tw-animate-css` replaces `tailwindcss-animate`; verify the drawer/dialog animate |
| The `letterSpacing` override is lost → text spacing shifts | It's an override, not an extend; port all 7 values, verify `tracking-tight`/`tracking-widest` |
| Token mapping drifts → colors subtly wrong | Keep `:root`/`.dark` triplets byte-identical; bridge via `@theme inline` only |
| The upgrade tool over-rewrites | Review every hunk; it can't know about the custom plugin |
| Removing autoprefixer breaks older-browser CSS | v4 includes it; verify the built CSS still carries the prefixes it needs |
| Tests pass while the site looks broken | **Visual check is the gate, not the test suite** |

## Success criteria

Tailwind 4 with `@tailwindcss/postcss`; no `autoprefixer`, no `tailwindcss-animate`, no `flattenColorPalette`, no custom color plugin. Theme fully in CSS; `:root`/`.dark` triplets unchanged. All gates + **CI green**. **The app is visually indistinguishable from before — verified by eye, in both themes, across all five pages.**
