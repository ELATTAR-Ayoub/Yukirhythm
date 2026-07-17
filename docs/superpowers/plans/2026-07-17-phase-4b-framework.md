# Phase 4B — Next 16 + React 19 + ESLint 10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next 14 → 16, React 18 → 19, ESLint 8 → 10 (flat config), with **zero user-visible change**.

**Architecture:** Four isolated steps, each gated + committed separately: Next 15 → ESLint 9/flat → Next 16 → React 19. Nothing is bundled that doesn't have to be — today's repeated lesson is that couplings surprise you, and a combined change makes the cause unknowable.

**Tech Stack:** Next.js (App Router), React, TypeScript 5.9.3, ESLint, Vitest 4 + Testing Library, Zustand, Radix UI, `apps/web` in an npm-workspaces monorepo.

**Working branch:** `v2_2026` — commit directly to it, do NOT create a new branch.

**Context for the engineer:**
- Gates run from the **repo root**: `npm run lint && npm run typecheck && npm test && npm run build`
- **41 tests in 12 files** must stay passing. ⚠️ **A dropping test count is a FAILURE, not a win** — it means tests stopped being collected.
- ⚠️ **Do NOT run `format:check` locally** (Windows CRLF false-positives). **Run `npx prettier --write` on any file you create/edit**; CI checks formatting and has caught this twice.
- `npm install` runs from the **ROOT** (workspaces; lockfile at root). Use `--workspace apps/web`.
- Real `.env` at `apps/web/.env` (gitignored) so `npm run build` works.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **The 4A component smoke tests are the tripwire for this phase**: `components/Logo.test.tsx`, `components/player/controls.test.tsx`, `components/player/ListDrawer.test.tsx`, `components/Header.test.tsx`, `sections/Hero.test.tsx`, `components/forms/login.test.tsx`. If they break, that's the signal — investigate, don't delete.

**Verified recon (do not re-litigate):**
- `next@16` peers `react: ^18.2.0 || ^19.0.0` → **Next 16 does NOT force React 19.**
- `next@16` engines: `node >=20.9.0`.
- All installed `@radix-ui/*` already peer `^19` → **no Radix bumps needed.**
- `react-player@2.11` peers `>=16.6.0` → **stays on v2.** (v3 is a rewrite; deferred to 4D.)
- `@testing-library/react@16.3` peers `^18 || ^19` → fine.
- **Only `vaul@0.9.2` and `sonner@1.5.0` block React 19.**
- `eslint-config-next@15` peers `eslint ^7 || ^8 || ^9`; `eslint-config-next@16` peers `eslint >=9`.
- Latest 15.x is **15.5.20**; latest 16.x is **16.2.10**.

**🚫 HARD RULES:**
- **Do NOT touch TypeScript.** TS 7 is blocked (its npm package is a CLI-only shim with no JS API — it breaks Next). Stay on **5.9.3**. Do not "helpfully" retry it.
- **Do NOT upgrade** firebase, zod, @hookform/resolvers, tailwind*, react-player, or Radix — those are 4C/4D.
- **Do NOT fix** the `userName.slice(0.2)` avatar bug — real, but it's a behavior change with its own task.
- **After every install, run `npm ls <pkg>`** to check npm didn't "resolve" a peer conflict by nesting a duplicate instance. That failure is silent (see the ESLint 10 finding in 4A).

---

## Task 1: Next 14 → 15 (+ the async params fix)

**Files:** `apps/web/package.json`, `apps/web/app/profile/[id]/page.tsx`, root `package-lock.json`.

Next 15's headline breaking change is that request APIs became async. **In this codebase it affects exactly ONE file** — `app/profile/[id]/page.tsx` (verified: no `cookies()`, `headers()`, or `searchParams` usage anywhere).

- [ ] **Step 1: Upgrade Next + its lint config**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install next@15 --workspace apps/web
npm install --save-dev eslint-config-next@15 --workspace apps/web
```
Expected: `next@15.5.20`, `eslint-config-next@15.x`. React stays 18; ESLint stays 8 (`eslint-config-next@15` allows `^8`).
Report installed versions and ALL peer warnings. Then:
```bash
npm ls next eslint-config-next eslint react
```
Confirm **single instances**, no nesting, no UNMET PEER.

- [ ] **Step 2: Fix the async `params`**

`app/profile/[id]/page.tsx` is a **Client Component** (`"use client"` on line 1). In Next 15 `params` is a `Promise`; a Client Component unwraps it with React's `use()`.

Change the import on line 3:
```tsx
import { use, useState, useEffect } from "react";
```
Change the signature (line 27) — this also removes the `: any`:
```tsx
const Page = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
```
Then replace **every** `params.id` with `id`. There are four, at approximately:
- line 52 — `await getProfileUser(params.id)`
- line 57 — the `useEffect` dep array `[params.id]`
- line 102 — `<UserAudioList id={params.id} />`
- line 116 — `<UserCollectionList id={params.id} />`

Grep afterwards to be sure none remain:
```bash
grep -n "params" apps/web/app/profile/\[id\]/page.tsx
```
Expected: only the signature line.
**Do NOT change anything else in this file** — not the loading state, not the JSX, not `getProfileUser`.

NOTE: `use()` suspends. `app/loading.tsx` exists and provides the Suspense boundary. If the build complains about a missing Suspense boundary, STOP and report rather than restructuring the page.

- [ ] **Step 3: Gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green, **41 tests**, 7 routes.
Quote anything Next 15 says about deprecations or codemods in your report.

- [ ] **Step 4: Format + commit**

```bash
cd apps/web && npx prettier --write "app/profile/[id]/page.tsx"
cd D:\Dev\YukiRythem\Yukirhythm
git add apps/web/package.json "apps/web/app/profile/[id]/page.tsx" package-lock.json
git commit -m "feat(next): upgrade to Next 15 and await async params

Next 15 made request APIs async. The profile page is a Client Component, so
params is unwrapped with React's use(). Also drops an untyped `any`.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: ESLint 8 → 9 + flat config

**Files:** delete `apps/web/.eslintrc.json`; create `apps/web/eslint.config.mjs`; modify `apps/web/package.json`, possibly `apps/web/next.config.js`.

`eslint-config-next@15` permits ESLint 9, so this lands **without touching Next again**.

🎯 **THE CRITICAL REQUIREMENT: lint coverage must not shrink.** Phase 0 fixed a bug where `next lint` silently skipped `context/`, `config/`, `constants/`, `sections/`, `store/` — that's why `eslint.dirs` exists in `next.config.js`. **A green lint run is NOT evidence of coverage.**

- [ ] **Step 1: Record the CURRENT baseline (you'll compare against this)**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint 2>&1 | tee /tmp/lint-before.txt
grep -c "Warning:" /tmp/lint-before.txt
```
Record the **exact warning count and which files they're in**. Expect ~9 warnings (`react-hooks/exhaustive-deps`, `@next/next/no-img-element`) across `app/profile/[id]/page.tsx`, `ListDrawer.tsx`, `UserAudioList.tsx`, `UserCollectionsList.tsx`, `Hero.tsx`.

- [ ] **Step 2: Upgrade ESLint**

```bash
npm install --save-dev eslint@9 --workspace apps/web
npm ls eslint
```
Confirm a **single** ESLint instance (no nested duplicate under `eslint-config-next`). If npm nested a second copy, STOP and report — that's the silent-failure mode from 4A.

- [ ] **Step 3: Check whether `eslint-config-next@15` ships a native flat config**

```bash
cat node_modules/eslint-config-next/package.json
ls node_modules/eslint-config-next/
```
Look for an `exports` map / a flat entry point. **Prefer a native flat config** if present. Otherwise use `FlatCompat`:
```bash
npm install --save-dev @eslint/eslintrc @eslint/js --workspace apps/web
```
Report which route you took.

- [ ] **Step 4: Create `apps/web/eslint.config.mjs`** (FlatCompat route)

```js
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "public/**"],
  },
  ...compat.extends("next/core-web-vitals"),
  prettier,
];
```

- [ ] **Step 5: Delete the old config + fix the lint script**

```bash
git rm apps/web/.eslintrc.json
```
`npm run lint` is `next lint`, which may not support flat config (and is deprecated in newer Next). If it doesn't work, change the script in `apps/web/package.json` to:
```json
    "lint": "eslint .",
```
Report which you ended up with. **If you switch to `eslint .`, `next.config.js`'s `eslint.dirs` no longer drives coverage** — flat config globs from the workspace root instead, which should cover MORE. That's fine **only if you prove it** in Step 6.

- [ ] **Step 6: 🎯 PROVE coverage did not shrink**

Two checks, both required:

**(a) Warning parity.** Run `npm run lint` and compare against `/tmp/lint-before.txt`. The same warnings, in the same files, should still appear. **If warnings vanished, that's a coverage REGRESSION, not a win** — investigate.

**(b) Plant a violation in a previously-at-risk directory.** Temporarily add an obviously-bad line to a file in `store/` and one in `context/` — e.g. append to `apps/web/store/player.ts`:
```ts
const __coverage_probe = 1;
```
(an unused variable — `@typescript-eslint/no-unused-vars` or `noUnusedLocals` should flag it; if the ESLint config doesn't include that rule, use something `next/core-web-vitals` definitely catches, like an `<img>` tag in a component under `context/`).
Run `npm run lint`, **confirm it is reported**, then remove the probe and confirm lint is clean again.
**Report exactly what you planted, in which files, and the exact lint output that proved it was seen.** If you cannot prove a directory is linted, say so plainly — do not hand-wave.

- [ ] **Step 7: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add -A
git commit -m "chore(lint): upgrade to ESLint 9 with flat config

Replaces .eslintrc.json with eslint.config.mjs. Coverage proved unchanged by
warning parity plus a planted violation in store/ and context/.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Confirm no probe code was committed.

---

## Task 3: Next 15 → 16 (+ ESLint 10, Node 22)

**Files:** `apps/web/package.json`, root `.nvmrc`, `apps/web/.nvmrc`, `.github/workflows/ci.yml`, root `package-lock.json`.

- [ ] **Step 1: Upgrade**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install next@16 --workspace apps/web
npm install --save-dev eslint-config-next@16 eslint@10 --workspace apps/web
npm ls next eslint eslint-config-next react
```
`eslint-config-next@16` requires `eslint >=9`, so ESLint 10 is fine. Confirm **single instances, no nesting**. Report all peer warnings.
React stays on **18** — `next@16` peers `^18.2.0 || ^19.0.0`.

- [ ] **Step 2: Bump Node to 22 LTS**

Next 16 requires `node >=20.9.0`. Bump for headroom and to keep CI honest:
- Root `.nvmrc` → `22`
- `apps/web/.nvmrc` → `22` (both exist; keep them in sync)
- Root `package.json` `engines.node` → `">=20.9"`
- `apps/web/package.json` `engines.node` → `">=20.9"`
- `.github/workflows/ci.yml` uses `node-version-file: ".nvmrc"` — confirm it picks up the ROOT `.nvmrc` (it does; the job runs from the root). No change needed unless it's pinned elsewhere.

- [ ] **Step 3: Gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green, **41 tests**, 7 routes.
Next 16 may deprecate `next lint` outright — if `npm run lint` breaks, switch the script to `eslint .` (if Task 2 hasn't already) and report.
**Quote any Next 16 migration warnings.** If Next 16 demands a codemod, run it, **review the diff**, and report what it changed — a codemod is a starting point, not an authority.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(next): upgrade to Next 16 and ESLint 10; Node 22

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: React 18 → 19

**Files:** `apps/web/package.json`, root `package-lock.json`, possibly component files.

- [ ] **Step 1: Upgrade React + types + the two blocking libs**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install react@19 react-dom@19 --workspace apps/web
npm install --save-dev @types/react@19 @types/react-dom@19 --workspace apps/web
npm install vaul@latest sonner@latest next-themes@latest --workspace apps/web
npm ls react react-dom
```
Why these three libs: `vaul@0.9.2` peers `^16.8 || ^17 || ^18` and `sonner@1.5.0` peers `^18.0.0` — **both block React 19**. `next-themes@0.2.1`'s peer is `*`, so npm won't complain, but a permissive range isn't evidence of support — bump it deliberately.
**Do NOT bump Radix or react-player** — verified already React-19 compatible.
Confirm **single** react/react-dom instances (a duplicate React is a classic silent breaker). Report all peer warnings.

- [ ] **Step 2: Typecheck — expect the types to surface any real issues**

```bash
npm run typecheck
```
`@types/react@19` is stricter. Known React 19 changes to look for:
- `ref` is now a regular prop (`forwardRef` still works — do NOT refactor it away)
- `propTypes` / `defaultProps` removed for function components
- string refs removed
- `useRef` now requires an argument

Fix genuine type errors **minimally**. Do NOT add `any`, do NOT weaken tsconfig, do NOT refactor components beyond what the compiler demands. If a fix needs real restructuring, **STOP and report**.

- [ ] **Step 3: Gate — the smoke tests earn their keep here**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green, **41 tests**, 7 routes.
**If a 4A smoke test fails, that is the tripwire doing its job.** Investigate the root cause and report it. **Do NOT delete or weaken a test to get green** — that would defeat the entire purpose of 4A.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(react): upgrade to React 19

Bumps vaul and sonner, whose peers blocked React 19, and next-themes.
Radix and react-player already support 19 and are unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Push and prove CI green

- [ ] **Step 1: Full gate + push**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint && npm run typecheck && npm test && npm run build
git push origin v2_2026
```

- [ ] **Step 2: Confirm CI green**

```bash
gh run list --branch v2_2026 --limit 1
```
Poll until `completed`, then `gh run view <run-id>`.
**CI runs `format:check`, which local runs cannot** — if it fails, `npx prettier --write` the named files, commit, push again.
Also confirm CI's Node version matches the new `.nvmrc`.
**CI green is the definition of done.**

- [ ] **Step 3: Report**

Final versions (next, react, eslint, node), test count, the lint-coverage proof from Task 2, anything a codemod changed, and the CI run URL.

---

## Definition of Done

- [ ] Next **16**, React **19**, ESLint **10** + flat config, TypeScript **5.9.3** (untouched).
- [ ] `app/profile/[id]/page.tsx` uses `use(params)` and is properly typed (no `any`).
- [ ] **Lint coverage provably unchanged** (warning parity + planted-violation proof).
- [ ] **41 tests** still passing — none deleted or weakened.
- [ ] Node 22 in `.nvmrc` (both), `engines`, and CI.
- [ ] No firebase/zod/tailwind/react-player/Radix bump; no TypeScript change; no avatar-bug fix.
- [ ] **CI green on `v2_2026`.**
- [ ] No app behavior change.

## Owner smoke test (mandatory — automated tests can't cover this)

`npm run dev`, then: home loads → search returns → add a track → play/pause → skip → volume → open drawer → delete a track → sign in → **visit `/profile/<your-uid>` (this is the async-params change — the highest-risk spot)** → liked songs render → collections render → theme toggle. Playback through YouTube must work.

## Self-review notes (author)

- **Spec coverage:** 4B-1 → Task 1; 4B-2 → Task 2; 4B-3 → Task 3; 4B-4 → Task 4; CI → Task 5. ✅
- **Isolation is the whole design:** four separate framework/lint/renderer moves, each gated and committed alone, because today proved couplings surprise you (TS 7's shim, ESLint's peer nesting).
- **The two known landmines are encoded:** the silent duplicate-instance install (`npm ls` after every install), and the silent lint-coverage regression (planted-violation proof, not a green run).
- **Hard rules restated where a subagent would be tempted:** don't retry TS 7, don't bump Radix/react-player, don't delete a failing smoke test.
- **Honest gap:** I have not read Next 16's full migration guide — my knowledge predates it. Tasks 3's steps therefore instruct the engineer to *read and quote* Next's own warnings/codemod output rather than trusting my sketch of what changed.
