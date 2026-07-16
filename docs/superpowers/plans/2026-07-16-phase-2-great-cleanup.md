# Phase 2 — The Great Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete ~18 unused dependencies, 7 dead files, ~13 stray `console.log`s, 4 commented-out blocks, and config cruft — with **zero behavior change**.

**Architecture:** Deletion only. No upgrades, no refactors, no new code. Delete in **small batches, running the full gate after each**, so any breakage points at exactly one batch. Order matters: **files first** (which frees up dependencies and store exports), then dependencies, then dead code, then config.

**Tech Stack:** Next.js 14 App Router in `apps/web` (npm workspaces monorepo). Gates: `lint`, `format:check`, `typecheck`, `test` (19), `build`.

**Working branch:** `v2_2026` (spec committed there). **Do not create a new branch — commit directly to `v2_2026`.**

**Context for the engineer:**
- Run gates from the **repo root** (`D:\Dev\YukiRythem\Yukirhythm`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. The root scripts delegate into `apps/web`.
- The real `.env` lives at `apps/web/.env` (gitignored) so `npm run build` works locally without placeholders.
- ⚠️ **`npm run format:check` fails LOCALLY with Windows CRLF false-positives — this is expected noise.** Do NOT reformat to "fix" it, and do NOT let it stop you. **CI is the source of truth** (it previously hid four genuinely unformatted files inside that noise).
- **Never run a format pass in this phase.** This is deletions only. If Prettier would change a file you didn't delete from, that's a real finding — report it.
- After deleting deps, run `npm install` from the **root** (workspaces; the lockfile is at the root — there is no `apps/web/package-lock.json`). Commit the updated root `package-lock.json`.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do NOT touch: the player, `pages/api/searchEngine.ts`, `scripts/migrate-users-to-uid.ts`, or anything in `apps/web/components/ui/` (all confirmed in use).

**Definition of the gate** (referred to below as "run the gate"):
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
All four must pass. (`format:check` excluded locally — see above.)

---

## Task 1: Delete dead files

**Files deleted:** `apps/web/components/CursorFollower.tsx`, `apps/web/components/SideBar.tsx`, `apps/web/components/Footer.tsx`, `apps/web/styles/cursor.css`, `apps/web/utils/motion.ts`, `apps/web/pages/api/hello.ts`, `apps/web/toDo`
**Files modified:** `apps/web/next.config.js`

- [ ] **Step 1: Confirm each file is truly unreferenced before deleting**

For each of the 7 files, grep the whole of `apps/web` (excluding `node_modules`, `.next`) for imports of it. Expected: no importers.
```bash
cd apps/web
grep -rn "CursorFollower\|SideBar\|/Footer\|cursor.css\|utils/motion\|api/hello" --include=*.ts --include=*.tsx --include=*.js . | grep -v node_modules | grep -v "\.next"
```
Expected: no results (other than the files' own definitions). **If ANY file turns out to be imported, STOP and report — do not delete it.**

- [ ] **Step 2: Delete them**

```bash
git rm apps/web/components/CursorFollower.tsx
git rm apps/web/components/SideBar.tsx
git rm apps/web/components/Footer.tsx
git rm apps/web/styles/cursor.css
git rm apps/web/utils/motion.ts
git rm apps/web/pages/api/hello.ts
git rm apps/web/toDo
```

- [ ] **Step 3: Fix `next.config.js` — `utils/` is now empty**

`utils/motion.ts` was the ONLY file in `apps/web/utils/`, so that directory no longer exists and `eslint.dirs` must not reference it. Replace the file with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  eslint: {
    dirs: [
      "app",
      "pages",
      "components",
      "lib",
      "context",
      "config",
      "constants",
      "sections",
      "store",
      "__tests__",
    ],
  },
};

module.exports = nextConfig;
```
(Only `"utils"` is removed here. `experimental: {}` is removed later, in Task 6.)

- [ ] **Step 4: Run the gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all pass, 19 tests. If `next lint` complains about a missing directory, that's the `utils` entry — confirm Step 3 was applied.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete dead files

Removes CursorFollower (an unused copy of Loader), SideBar, Footer,
cursor.css, utils/motion.ts (framer-motion variants for a library nothing
imports), the Next.js hello boilerplate, and the toDo notes file. None were
referenced anywhere. Drops the now-empty utils/ from eslint.dirs.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Remove dead dependencies (batch A — libraries)

**Files:** `apps/web/package.json`, root `package-lock.json`

Context: all verified to have **zero imports** in source or config. `framer-motion` appears only in `package.json`. `@nextui-org/react` is unused (so no HeroUI migration is ever needed). `postcss-nesting` is not registered in `postcss.config.js`.

- [ ] **Step 1: Re-verify each is unimported** (cheap insurance before deleting)

```bash
cd apps/web
for p in framer-motion @nextui-org/react gsap gsap-trial @splinetool/react-spline @splinetool/runtime matter-js nodemailer node-fetch lucide-react @next/font postcss-nesting; do
  echo "--- $p ---"
  grep -rn "$p" --include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.css . | grep -v node_modules | grep -v "\.next" | grep -v package.json | grep -v package-lock
done
```
Expected: no hits for any of them (a hit in `package.json` only is fine and filtered out above). **If any has a real hit, STOP and report — do not remove that one.**
NOTE: `gsap-trial` will also match the string `gsap`; read results carefully.

- [ ] **Step 2: Remove from `apps/web/package.json`**

Delete these lines from `"dependencies"`:
```
    "@next/font": "13.1.2",
    "@nextui-org/react": "^1.0.0-beta.12",
    "@splinetool/react-spline": "^2.2.6",
    "@splinetool/runtime": "^0.9.425",
    "@types/tailwindcss": "^3.1.0",
    "framer-motion": "^8.5.5",
    "gsap": "^3.12.2",
    "gsap-trial": "^3.12.2",
    "lucide-react": "^0.439.0",
    "matter-js": "^0.19.0",
    "node-fetch": "^3.3.0",
    "nodemailer": "^6.9.5",
```
And these from `"devDependencies"`:
```
    "@types/matter-js": "^0.19.0",
    "@types/nodemailer": "^6.4.10",
    "postcss-nesting": "^12.0.1",
```
Leave every other entry untouched. Do NOT change any surviving version number.

- [ ] **Step 3: Reinstall from the root**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install
```
Expected: succeeds and updates the root `package-lock.json`. This should REMOVE packages, not add or bump any. Sanity-check with `git diff --stat package-lock.json` — a large deletion is expected.

- [ ] **Step 4: Run the gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all pass, 19 tests, build compiles. **If the build fails, one of these packages was actually needed — report exactly which and stop.**

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): remove 15 unused packages

framer-motion, @nextui-org/react, gsap, gsap-trial, @splinetool/*,
matter-js, nodemailer, node-fetch, lucide-react, @next/font,
postcss-nesting, and their @types. All verified to have zero imports in
source or config. Removes the need for the planned NextUI->HeroUI and
framer-motion->motion migrations entirely.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Remove dead Redux packages (batch B)

**Files:** `apps/web/package.json`, root `package-lock.json`

Context: `redux`, `redux-thunk`, and `redux-provider` have **zero direct imports** — `@reduxjs/toolkit` bundles redux and thunk, and `react-redux` supplies `Provider`. **`@reduxjs/toolkit`, `react-redux`, and `next-redux-wrapper` MUST STAY** — they're still imported by `store/` and are removed in Phase 3 with the Zustand rewrite.

- [ ] **Step 1: Verify no direct imports**

```bash
cd apps/web
grep -rn "from \"redux\"\|from 'redux'\|redux-thunk\|redux-provider" --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v "\.next"
```
Expected: no results. **If there are hits, STOP and report.**

- [ ] **Step 2: Remove from `apps/web/package.json` `"dependencies"`**

```
    "redux": "^4.2.0",
    "redux-provider": "^1.0.0",
    "redux-thunk": "^2.4.2",
```
Do NOT remove `@reduxjs/toolkit`, `react-redux`, or `next-redux-wrapper`.

- [ ] **Step 3: Reinstall + gate**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all pass. (RTK still works — it vendors its own redux/thunk.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): remove redux, redux-thunk, redux-provider

No direct imports: @reduxjs/toolkit bundles redux and thunk, react-redux
supplies Provider. RTK/react-redux/next-redux-wrapper stay until the
Zustand migration in Phase 3.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Remove dead code

**Files:** `apps/web/components/forms/signup.tsx`, `apps/web/components/forms/login.tsx`, `apps/web/components/player/ListDrawer.tsx`, `apps/web/context/AuthContext.tsx`, `apps/web/components/Header.tsx`, `apps/web/components/player/controls.tsx`, `apps/web/components/player/UserCollectionsList.tsx`, `apps/web/components/Logo.tsx`

⚠️ **Line numbers below are from an earlier scan and WILL have shifted. Locate every item by CONTENT, not line number.**

- [ ] **Step 1: Remove stray `console.log` calls**

Delete `console.log(...)` statements in these files:
- `components/forms/signup.tsx` (2 occurrences)
- `components/forms/login.tsx` (includes a `console.log("sdd")` debug leftover)
- `components/player/ListDrawer.tsx` (3 occurrences)
- `context/AuthContext.tsx` (8 occurrences)

**KEEP:**
- every `console.error(...)` — that's real error reporting
- all output in `scripts/migrate-users-to-uid.ts` — intentional CLI UX, eslint-disabled

Be careful: if a `console.log` is the ONLY statement in a block (e.g. `.then(() => { console.log(...) })` or an `if`), removing it must leave valid, sensible code. If removing one would change control flow, leave it and report.

- [ ] **Step 2: Remove commented-out code blocks**

Delete these (locate by content):
- `components/Header.tsx` — a ~5-line commented-out `<div>` (old footer/copyright bar)
- `components/player/controls.tsx` — a ~9-line commented-out `<input type="range" ... className="SeekBar">` superseded by the live `<Slider>` right below it
- `components/player/UserCollectionsList.tsx` — a ~9-line commented-out tags/`Badge` rendering block
- `components/Logo.tsx` — a single commented-out `<Image>` line

**Only remove commented-out CODE.** Keep explanatory comments and doc comments.

- [ ] **Step 3: Run the gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all pass, 19 tests.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove stray console.logs and commented-out code

Drops 13 debug console.log calls (including a console.log(\"sdd\")) and four
blocks of commented-out JSX. Keeps console.error error reporting and the
migration script's intentional CLI output.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Remove unused store exports

**Files:** `apps/web/store/UIConfig.ts`

Context: `setUIState` is unused **and** a no-op — `setUIState(state, action) { state = action.payload; }` reassigns the Immer draft variable, which does nothing. `selectUIState` is unused. `setLoading`/`selectLoading` were only imported by `Footer.tsx`/`CursorFollower.tsx`, which Task 1 deleted — so they're now unused too. **`setMenuToggle`/`selectMenuToggle` ARE used** (`components/Header.tsx`, `app/profile/[id]/page.tsx`) — keep them.

- [ ] **Step 1: Verify what's actually unused now** (Task 1 changed this)

```bash
cd apps/web
for s in setUIState selectUIState setLoading selectLoading setMenuToggle selectMenuToggle; do
  echo "--- $s ---"
  grep -rn "$s" --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v "store/UIConfig.ts"
done
```
Expected: hits ONLY for `setMenuToggle` / `selectMenuToggle`. **If `setLoading` or `selectLoading` still has a live importer, keep it and report.**

- [ ] **Step 2: Rewrite `apps/web/store/UIConfig.ts`**

```ts
import { createSlice } from "@reduxjs/toolkit";
import { AppState } from "./store";
import { HYDRATE } from "next-redux-wrapper";

// Type for our state
export interface UIState {
  MenuToggle: boolean;
  Loading: boolean;
}

// Initial state
const initialState: UIState = {
  MenuToggle: false,
  Loading: false,
};

// Actual Slice
export const UIConfigSlice = createSlice({
  name: "UIConfigSlice",
  initialState,
  reducers: {
    setMenuToggle(state, action) {
      state.MenuToggle = action.payload;
    },
  },
});

export const { setMenuToggle } = UIConfigSlice.actions;

export const selectMenuToggle = (state: AppState) => state.UIConfig.MenuToggle;

export default UIConfigSlice.reducer;
```
NOTE: the `HYDRATE` import is currently present and unused. If removing it keeps lint/typecheck green, remove that import line too (and report). The `Loading` field stays in `UIState` for now — the whole store is rewritten in Phase 3; do not restructure state shape here.

- [ ] **Step 3: Run the gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/store/UIConfig.ts
git commit -m "chore(store): drop unused UIConfig exports

Removes setUIState (unused, and a no-op: reassigning an Immer draft does
nothing), selectUIState, and setLoading/selectLoading (only consumers were
the deleted Footer/CursorFollower). Keeps setMenuToggle/selectMenuToggle.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Config cruft

**Files:** `apps/web/tsconfig.json`, `apps/web/next.config.js`, `apps/web/package.json`

- [ ] **Step 1: Fix `tsconfig.json` `include`**

It currently lists `pages/_app.js` and `sections/fallingWords.jsx`, **neither of which exists**, plus `components/Loader.tsx`, which is redundant with the `**/*.tsx` glob. Replace the `include` array with:

```json
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
```
Leave `compilerOptions` and `exclude` untouched.

- [ ] **Step 2: Remove the vestigial `experimental: {}` from `next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: [
      "app",
      "pages",
      "components",
      "lib",
      "context",
      "config",
      "constants",
      "sections",
      "store",
      "__tests__",
    ],
  },
};

module.exports = nextConfig;
```

- [ ] **Step 3: Move build-time-only packages to `devDependencies`**

`typescript`, `@types/node`, `@types/react`, and `@types/react-dom` are currently in `"dependencies"` but are build/type-time only. Move these four entries from `"dependencies"` to `"devDependencies"` (keep the exact same version strings):
```
    "@types/node": "18.11.18",
    "@types/react": "^18.0.26",
    "@types/react-dom": "18.0.10",
    "typescript": "^5.2.2",
```
Keep both blocks alphabetically ordered, as they are now.

- [ ] **Step 4: Reinstall + run the gate**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all pass. `next build` still typechecks fine with TypeScript in devDependencies. **If the build fails because of the devDependencies move, revert JUST Step 3 and report.**

- [ ] **Step 5: Commit**

```bash
git add apps/web/tsconfig.json apps/web/next.config.js apps/web/package.json package-lock.json
git commit -m "chore: clean up config cruft

tsconfig include no longer references two files that don't exist
(pages/_app.js, sections/fallingWords.jsx) or a path already covered by the
glob. Drops the empty experimental:{} from next.config. Moves typescript and
@types/* to devDependencies where they belong.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Push and prove CI green

**Files:** none

- [ ] **Step 1: Final full gate, including format:check**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint && npm run typecheck && npm test && npm run build
npx prettier --check apps/web 2>&1 | tail -5
```
For `format:check`: the ONLY acceptable failures are Windows CRLF false-positives on files this phase did NOT touch. If a file you edited is genuinely unformatted, fix **that file only** (`npx prettier --write <file>`) and amend it into the relevant commit or add a follow-up commit. Do NOT run a repo-wide format pass.

- [ ] **Step 2: Push**

```bash
git push origin v2_2026
```

- [ ] **Step 3: Confirm CI is green — this is the real gate**

```bash
gh run list --branch v2_2026 --limit 1
```
Poll until `completed`. Then:
```bash
gh run view <run-id>
```
Expected: the `web` job green (lint, format:check, typecheck, test, build).
**If CI fails, diagnose with `gh run view <run-id> --log-failed`, fix, and push again. CI green is the definition of done — do not hand back a red pipeline.**

- [ ] **Step 4: Report the before/after**

Report: number of packages removed, files deleted, lines removed (`git diff --stat <base>..HEAD`), and confirm the `next build` route table is unchanged from before the phase.

---

## Definition of Done

- [ ] 15 unused packages + 3 dead Redux packages removed; `apps/web/package.json` holds only genuinely-imported packages (except RTK/react-redux/next-redux-wrapper, held for Phase 3).
- [ ] 7 dead files gone; `utils/` no longer exists and isn't referenced in `eslint.dirs`.
- [ ] No stray `console.log` outside `console.error` and the migration CLI; no commented-out code blocks.
- [ ] `UIConfig` exports only what's used.
- [ ] `tsconfig` `include` references only existing paths; no `experimental: {}`; `typescript`/`@types/*` in devDependencies.
- [ ] **CI green on `v2_2026`.**
- [ ] The app behaves identically — no user-visible change.

## Owner smoke test (after merge, with the real `.env`)

`npm run dev`, then: home loads → search returns results → add + play a track → sign in → profile shows liked songs and collections → menu toggles.

## Self-review notes (author)

- **Spec coverage:** spec §A (dead deps) → Tasks 2–3; §B (dead files) → Task 1; §C (dead code) → Tasks 4–5; §D (config cruft) → Task 6; testing/CI → Task 7. ✅
- **Ordering is deliberate:** files first (frees `framer-motion` and `setLoading`/`selectLoading`), then deps, then dead code, then config. Each batch gates independently.
- **Held-back packages are consistent:** RTK/react-redux/next-redux-wrapper are excluded in Task 3 and Task 5 keeps their imports working; Phase 3 removes them.
- **Placeholder scan:** no TBDs; every step has concrete content or an explicit verification command. ✅
- **Known trap encoded:** local `format:check` CRLF noise is called out in the context AND in Task 7, because it previously hid four real failures for two phases.
