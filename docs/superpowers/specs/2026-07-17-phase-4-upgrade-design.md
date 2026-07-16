# Phase 4 — Upgrade the Stack (Design)

**Date:** 2026-07-17
**Project:** Yukirhythm
**Branch:** `v2_2026`
**Risk:** 🔴 High — multiple major-version jumps across the framework, compiler, and styling engine

---

## Goal

Bring every dependency to a current, supported version, so the app is maintainable "for ages" rather than pinned to a 2023 stack. **No user-visible change** — same look, same behavior.

## Reality check: the gap is bigger than the roadmap assumed

| Package | Current | Target | Jump |
|---|---|---|---|
| `next` | 14.0.1 | **16.x** | 2 majors |
| `react` / `react-dom` | 18.2.0 | **19.x** | 1 major |
| `typescript` | 5.2 | ~~7.x~~ → **5.9** | ⚠️ **TS 7 BLOCKED — see below** |
| `eslint` | 8.57 | **10.x** | 2 majors — *flat config* |
| `tailwindcss` | 3.2 | **4.x** | 1 major — *CSS-first config* |
| `vitest` / `vite` | 2.1 / 5.4 | **4.x / 7.x** | 2 majors |
| `firebase` | 10.5 | **12.x** | 2 majors |
| `react-player` | 2.11 | **3.x** | 1 major — *rewrite* |
| `zod` + `@hookform/resolvers` | 3.23 / 3.9 | **4.x / 5.x** | 1–2 majors |
| `sonner` · `vaul` · `tailwind-merge` · `next-themes` | 1.5 · 0.9 · 2.5 · 0.2 | 2.x · 1.x · 3.x · 0.4 | 1 major each |
| `@types/node` · `@types/react` | 18 · 18 | 22 · 19 | — |

**Phase 2 already shrank this materially:** the planned NextUI→HeroUI and framer-motion→`motion` migrations are gone — both libraries were unused and were deleted.

### ⚠️ FINDING (2026-07-17): TypeScript 7 is not adoptable — and not because of Next

Attempted in 4A and **deliberately reverted to TypeScript 5.9.3**. The reason is more fundamental than a version bound, and it changes the guidance:

**`typescript@7.0.2` on npm is a CLI-only shim.** Verified directly:
```
require("typescript") → export count: 2
keys: ["version", "versionMajorMinor"]
sys / readConfigFile / parseJsonConfigFileContent → undefined
main: undefined, bin: { tsc }
```
The real compiler is a native Go binary; **the JavaScript compiler API is gone**. So `tsc --noEmit` (a CLI) works fine, while *every tool that reads the TS API breaks*. Next calls `ts.readConfigFile`/`ts.parseJsonConfigFileContent` to load `paths`; under TS 7 those are `undefined`, Next swallows the error, `paths` comes back empty, `JsConfigPathsPlugin` bails, and **every `@/*` import fails to resolve** — surfacing as misleading "Module not found" webpack errors that say nothing about TypeScript.

**This is NOT "retry after Next 16."** It affects any TS-API consumer (Next, ESLint's TS tooling, ts-node, IDE integrations). TS 7 is blocked until the npm package ships a JS API or the tooling ecosystem adapts. Re-evaluate by re-running the check above — not by assuming a newer Next fixes it.

**What was kept (valuable regardless):** `moduleResolution: "node"` → **`"bundler"`** and `baseUrl` removed — the config Next recommends, and what Next 16 will want anyway. Phase 0 deliberately deferred this ("revisited later"); it's now done. This surfaced `TS2882` on plain `.css` side-effect imports (Next only declares `*.module.css`); fixed with `apps/web/types/css.d.ts` → `declare module "*.css" {}` (empty body — no `any`). Confirmed *not* a TS 7 artifact by reproducing the same errors on TS 5.9.

---

## ⚠️ The honest problem: our test suite can't catch what this phase breaks

We have 29 tests, and they cover the **store**, the **search helpers**, and `cn()`. **They do not render a single application component.** A React 19 or Next 16 change that breaks `Hero`, `controls`, or the forms would sail past `npm test` and only show up as a runtime error in front of a user.

That is not an acceptable net for a phase this risky. So **4A strengthens the net before anything risky moves.**

---

## Sub-phases

Each is independently shippable and CI-gated. Order is deliberate: net first, then the isolated changes, then the framework.

### 4A — Strengthen the net, then upgrade tooling
1. **Add component smoke tests** (the important part): render `Header`, `Hero`, `controls`, `ListDrawer`, and the three forms with mocked Firebase/store, asserting they mount without crashing and show key elements. These become the tripwire for 4B.
2. Upgrade **TypeScript 5.2 → 7**, **ESLint 8 → 10** (migrate `.eslintrc.json` → flat `eslint.config.mjs`), **Vitest 2 → 4**, **Vite 5 → 7**, `@vitejs/plugin-react`, `@types/node` → 22.
3. Revisit `vite-tsconfig-paths` — Phase 0 pinned it to 4.3.2 because 5.x is ESM-only and this package isn't `type: module`. Newer Vite may resolve this; if not, stay pinned and note why.

**Risk:** 🟡 build-time only, but TypeScript 7 is a *native rewrite* — see Risks.

### 4B — Next 16 + React 19
1. **Step through 15 first**, verify, then 16. Two smaller, verifiable jumps beat one blind leap. Use `npx @next/codemod@latest upgrade`.
2. **Next 15's breaking change that bites us:** request APIs became async — `params`, `searchParams`, `cookies()`, `headers()`. **`app/profile/[id]/page.tsx` uses `params`** and must be updated.
3. React 19: `@types/react`/`@types/react-dom` → 19; verify `ref` handling, and that `next-themes`, `sonner`, `vaul`, and all `@radix-ui/*` are on React-19-compatible versions (bump the peers that force it).
4. `eslint-config-next` → 16.

**Risk:** 🔴 highest. This is what the 4A smoke tests exist for.

### 4C — Tailwind 4
1. Run `npx @tailwindcss/upgrade`. Tailwind 4 is **CSS-first**: config moves from `tailwind.config.js` into CSS (`@theme`), and `@tailwind` directives become `@import "tailwindcss"`.
2. `postcss.config.js` → `@tailwindcss/postcss`. **`autoprefixer` is no longer needed** (built in) — remove it.
3. `tailwindcss-animate` is v3-era → replace with `tw-animate-css` (or drop it if unused after review).
4. The existing custom theme (colors, the shadcn token layer in `globals.css`) must survive **visually identical**.

**Risk:** 🟡 isolated to styling, but a broken token mapping = a visibly broken app. Needs eyes-on comparison.

### 4D — Remaining libraries
- **`firebase` 10 → 12** — modular API is stable; verify auth + Firestore paths.
- **`zod` 3 → 4** + **`@hookform/resolvers` 3 → 5** — zod 4 changed error customization; the three form schemas need review.
- **`sonner` 1 → 2**, **`vaul` 0.9 → 1**, **`tailwind-merge` 2 → 3**, **`next-themes` → 0.4**.
- **`react-player` 2 → 3** — ⚠️ a **rewrite**, and it drives the player. Its config API changed (the `config.youtube.playerVars` shape we rely on). This is the single highest behavior risk in the phase. **If v3 requires meaningful player rework, staying on v2 is an acceptable outcome** — v2 still supports React 19 via its peer range. Do not break the player to win a version number.

**Risk:** 🟡–🔴 (react-player is the outlier).

---

## Non-goals (explicitly deferred)

- **No YouTube engine swap.** `@fabricio-191/youtube@0.0.4` stays. Replacing it with `youtubei.js` is a *behavior* change, not an upgrade — it belongs in its own phase with its own testing. (It remains a good idea: v0.0.4 is barely maintained and has broken type declarations.)
- **No player behavior change.** The hidden ReactPlayer, buffering spinner, `onError` skip, and toasts behave exactly as today.
- **No design changes.** Tailwind 4 must be visually identical; the design refresh is Phase 6.
- **No API/Route Handlers/Firestore-rules work** — Phase 5.
- **No new features.**

---

## Testing strategy

- **4A's component smoke tests are the phase's foundation** — they must land and pass *before* 4B begins.
- **Gates after every sub-phase:** `lint`, `format:check` (CI), `typecheck`, `test`, `build`. **CI green is the definition of done** — local `format:check` is unusable (Windows CRLF), and CI has already caught two real failures that local gates missed.
- **Manual smoke is mandatory** for 4B, 4C, and 4D — automated tests cannot cover visual regressions or YouTube playback. Owner runs: home → search → add → play/pause → skip → volume → drawer → delete → sign in → profile → liked songs → collections → theme toggle.
- **4C additionally needs a visual diff** — screenshot key pages before/after Tailwind 4 and compare.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **A React 19/Next 16 break slips past our thin tests** | 4A adds component smoke tests *first*; manual smoke on top |
| **TypeScript 7 is a native rewrite** and may have edge-case gaps vs 5.x | It's the current stable, and this codebase is small and strictly typed. Adopt in 4A **in isolation** so any fallout is unambiguous. If `typecheck` surfaces rewrite-specific breakage we can't resolve cleanly, **falling back to the latest 5.x/6.x is an acceptable outcome** — record why. |
| **react-player 3 rewrite breaks playback** | Isolated to 4D, last. Staying on v2 is an explicitly acceptable outcome. |
| **Tailwind 4 silently changes the look** | Visual before/after comparison; the upgrade tool + manual token review |
| Two-major jumps compound and obscure the cause | Sub-phases, and Next steps 14→15→16 rather than leaping |
| Radix/UI libs lack React 19 support | Verify peer ranges during 4B; bump together |
| A codemod rewrites more than intended | Review every codemod diff before committing; they're a starting point, not an authority |
| Node 20 too old for Next 16 | Bump `.nvmrc`/`engines` to Node 22 LTS if required; CI must match |

## Success criteria

Every dependency on a current supported major (or a documented, deliberate exception). `.eslintrc.json` replaced by flat config. Tailwind 4 with the theme visually identical. Component smoke tests exist and pass. All gates + **CI green on `v2_2026`**. The app looks and behaves exactly as it does today — verified by owner smoke test, not by assumption.
