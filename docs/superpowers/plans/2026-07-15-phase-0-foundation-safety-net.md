# Phase 0 — Foundation & Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reproducible baseline plus a lint/format/typecheck/test/CI safety net for Yukirhythm, with zero user-facing behavior change, so later modernization phases are safe.

**Architecture:** Pure tooling + config work on the existing Next.js 14 App Router stack. No dependency major-version upgrades, no logic changes beyond removing provably-dead code. Testable pure logic is covered with Vitest tests (TDD-shaped); tooling tasks are verified by running the tool and confirming output. Every task ends in a small, isolated commit.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, ESLint (`next/core-web-vitals`), Prettier, Vitest + Testing Library + jsdom, GitHub Actions.

**Working branch:** `phase-0-foundation` (already created; spec already committed there).

**Context notes for the engineer:**

- The repo uses **double quotes + semicolons** (see `lib/utils.ts`, `config/firebase.ts`). Match that; Prettier config below encodes it.
- Path alias `@/*` → repo root (from `tsconfig.json` `paths`).
- The only env vars the app reads are 7 `NEXT_PUBLIC_*` Firebase keys (grepped: `config/firebase.ts`). Nodemailer is a dependency but is **not** imported anywhere — do not invent env vars for it.
- `node_modules` is currently **absent**; the first task installs.
- Commit messages end with the `Co-Authored-By` trailer used across this project.

---

## File structure (what this phase creates/changes)

| File                                   | Responsibility                           | Task      |
| -------------------------------------- | ---------------------------------------- | --------- |
| `.nvmrc`                               | Pin supported Node version               | 1         |
| `package.json`                         | `engines`, new scripts, new devDeps      | 1,2,3,4,5 |
| `.eslintrc.js`                         | **deleted** (conflicting Airbnb config)  | 2         |
| `.eslintrc.json`                       | single ESLint config (+ prettier compat) | 2         |
| `.prettierrc` / `.prettierignore`      | formatting rules                         | 3         |
| `tsconfig.json`                        | `target` es5 → ES2020                    | 4         |
| `vitest.config.ts` / `vitest.setup.ts` | test harness                             | 5         |
| `lib/utils.test.ts`                    | smoke test (pure logic)                  | 5         |
| `__tests__/environment.test.tsx`       | smoke test (jsdom/RTL)                   | 5         |
| `.github/workflows/ci.yml`             | CI pipeline                              | 6         |
| `context/AuthContext.tsx`              | remove 2 dead imports                    | 7         |
| `pages/api/searchEngine.ts`            | remove dead `Data` global                | 7         |
| `config/firebase.ts`                   | `getAuth()` → `getAuth(app)`             | 7         |
| `.env.example`                         | document env vars                        | 8         |

---

## Task 1: Baseline install + Node pinning

**Files:**

- Create: `.nvmrc`
- Modify: `package.json` (add `engines`)

- [ ] **Step 1: Install dependencies from the existing lockfile**

Run: `npm ci`
Expected: completes and creates `node_modules/`. If `npm ci` fails because the lockfile is out of sync with the installed npm, fall back to `npm install` (which will update `package-lock.json`) and note that the lockfile was regenerated. Do **not** pass `--force` or `--legacy-peer-deps` unless a peer-dep error blocks install; if you must, record exactly why in the commit message.

- [ ] **Step 2: Verify the app builds on the current stack**

Run: `npm run build`
Expected: `next build` completes with "Compiled successfully" (warnings are acceptable; a failed build is not). If the build fails, capture the exact error. If the fix is a minor/patch change or config tweak, apply it and note it. If it requires a **major** dependency upgrade, STOP and report — that belongs in Phase 3, not here.

- [ ] **Step 3: Pin the Node version**

Create `.nvmrc`:

```
20
```

Add to `package.json` (top level, after `"private": true,`):

```json
  "engines": {
    "node": ">=20 <23"
  },
```

Rationale: Node 20 LTS is well-supported by Next.js 14. Local dev on a newer Node is fine; CI and the pin standardize on 20.

- [ ] **Step 4: Commit**

```bash
git add .nvmrc package.json package-lock.json
git commit -m "chore: pin Node 20 and verify baseline build

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Consolidate ESLint config

**Files:**

- Delete: `.eslintrc.js`
- Modify: `.eslintrc.json`
- Modify: `package.json` (add `eslint-config-prettier` devDep)

Context: there are currently TWO ESLint configs. `.eslintrc.js` uses Airbnb, `ecmaVersion 12`, and references a typo'd rule `eslintreact/no-danger`. We keep the Next-native one and add Prettier-compat so ESLint and Prettier don't fight.

- [ ] **Step 1: Delete the Airbnb config**

```bash
git rm .eslintrc.js
```

- [ ] **Step 2: Install eslint-config-prettier**

Run: `npm install --save-dev eslint-config-prettier`

- [ ] **Step 3: Update `.eslintrc.json`**

Replace the full contents of `.eslintrc.json` with:

```json
{
  "extends": ["next/core-web-vitals", "prettier"]
}
```

- [ ] **Step 4: Run lint and confirm it passes**

Run: `npm run lint`
Expected: exits 0. If real errors surface (not formatting), fix only trivial ones (unused vars, missing keys). If an error would require a logic change, disable that specific rule inline with a `// eslint-disable-next-line <rule> -- TODO(phase-1): <reason>` comment and note it. Do not change behavior.

- [ ] **Step 5: Commit**

```bash
git add .eslintrc.json package.json package-lock.json
git commit -m "chore: consolidate to single ESLint config with prettier compat

Removes conflicting Airbnb .eslintrc.js; keeps next/core-web-vitals.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Prettier setup + one-time format pass

**Files:**

- Create: `.prettierrc`, `.prettierignore`
- Modify: `package.json` (add `prettier` devDep + `format`/`format:check` scripts)

- [ ] **Step 1: Install Prettier**

Run: `npm install --save-dev prettier`

- [ ] **Step 2: Create `.prettierrc`** (encodes the existing style: double quotes, semicolons, 2-space)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 80,
  "tabWidth": 2
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
node_modules
.next
out
build
coverage
package-lock.json
public
```

- [ ] **Step 4: Add scripts to `package.json`** (inside `"scripts"`)

```json
    "format": "prettier --write .",
    "format:check": "prettier --check ."
```

- [ ] **Step 5: Commit the config alone (before reformatting)**

```bash
git add .prettierrc .prettierignore package.json package-lock.json
git commit -m "chore: add Prettier config and scripts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: Run the one-time format pass**

Run: `npm run format`
Expected: Prettier rewrites files to a consistent style. This is intentionally large but touches formatting only.

- [ ] **Step 7: Sanity-check the diff is formatting-only**

Run: `git diff --stat`
Expected: many files changed, but spot-check 3-4 with `git diff <file>` to confirm only whitespace/quote/wrapping changes — no logic changes. Then confirm the app still builds: `npm run build` → succeeds.

- [ ] **Step 8: Commit the format pass in isolation**

```bash
git add -A
git commit -m "style: apply one-time Prettier format pass

Formatting only, no logic changes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: TypeScript baseline

**Files:**

- Modify: `package.json` (add `typecheck` script)
- Modify: `tsconfig.json` (`target` es5 → ES2020)

- [ ] **Step 1: Add the typecheck script** (inside `"scripts"`)

```json
    "typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Bump the compile target in `tsconfig.json`**

Change the `compilerOptions.target` value from `"es5"` to `"ES2020"`. Leave every other option unchanged (do NOT touch `moduleResolution` — that is revisited in Phase 3).

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0. If pre-existing type errors appear (the codebase uses `strict: true` already, so most should already pass), fix only trivial ones (unused imports, obvious annotations). For any error that would require a logic change, add a narrowly-scoped `// @ts-expect-error TODO(phase-1): <reason>` on the offending line and record it. Do not change runtime behavior.

- [ ] **Step 4: Confirm build still succeeds**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json context/AuthContext.tsx
git commit -m "chore: add typecheck script and modernize TS target to ES2020

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(Include any files touched by trivial type fixes in the `git add`.)

---

## Task 5: Vitest harness + smoke tests

**Files:**

- Create: `vitest.config.ts`, `vitest.setup.ts`, `lib/utils.test.ts`, `__tests__/environment.test.tsx`
- Modify: `package.json` (test scripts + devDeps)

- [ ] **Step 1: Install test dependencies**

Run:

```bash
npm install --save-dev vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test scripts to `package.json`** (inside `"scripts"`)

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
```

- [ ] **Step 5: Write the failing pure-logic test** — `lib/utils.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("lets the last conflicting tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
```

- [ ] **Step 6: Write the failing environment test** — `__tests__/environment.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test environment", () => {
  it("renders React into jsdom and matchers work", () => {
    render(<button>Play</button>);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: both files pass (5 assertions total). If the `cn` "px-2/px-4" merge assertion fails due to a tailwind-merge version nuance, adjust the expected value to the actual merged output — the point is a real passing test, not a specific string.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts vitest.setup.ts lib/utils.test.ts __tests__/environment.test.tsx package.json package-lock.json
git commit -m "test: add Vitest harness with smoke tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: CI workflow

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      # Placeholder values so `next build` (which inlines NEXT_PUBLIC_* at
      # build time) succeeds without real Firebase secrets.
      NEXT_PUBLIC_APIKEY: ci-placeholder
      NEXT_PUBLIC_AUTHDOMAIN: ci-placeholder.firebaseapp.com
      NEXT_PUBLIC_PROJECTID: ci-placeholder
      NEXT_PUBLIC_STORAGEBUCKET: ci-placeholder.appspot.com
      NEXT_PUBLIC_MESSAGINGSENDERID: "0000000000"
      NEXT_PUBLIC_APPID: ci-placeholder
      NEXT_PUBLIC_MEASUREMENTID: G-CIPLACEHOLDER
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Verify the pipeline locally** (same order CI runs)

Run each and confirm success:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all four succeed in sequence.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline (lint, typecheck, test, build)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Safe cleanups (provably inert)

Each edit below is a guaranteed no-op at runtime, verified by the build + tests that follow.

**Files:**

- Modify: `context/AuthContext.tsx`
- Modify: `pages/api/searchEngine.ts`
- Modify: `config/firebase.ts`

- [ ] **Step 1: Remove the broken `@firebase/util` import** in `context/AuthContext.tsx`

Delete this line entirely (currently near line 25):

```ts
import { async } from "@firebase/util";
```

- [ ] **Step 2: Remove the unused `use` import** in `context/AuthContext.tsx`

Change the React import on line 1 from:

```ts
import { createContext, use, useContext, useEffect, useState } from "react";
```

to:

```ts
import { createContext, useContext, useEffect, useState } from "react";
```

- [ ] **Step 3: Remove the dead `Data` global** in `pages/api/searchEngine.ts`

- Delete the module-level declaration `var Data: Audio[] = [];` (near line 11).
- Delete the two `Data = [];` statements inside the `handler` (in the `try` after `res.status(200)...` and in the `catch` after `res.status(404)...`).
- Leave everything else in the file unchanged. (`Data` is written but never read — removing it cannot change behavior.)

- [ ] **Step 4: Fix `getAuth()` in `config/firebase.ts`**

Change:

```ts
export const auth = getAuth();
```

to:

```ts
export const auth = getAuth(app);
```

- [ ] **Step 5: Verify nothing regressed**

Run:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add context/AuthContext.tsx pages/api/searchEngine.ts config/firebase.ts
git commit -m "chore: remove dead imports/globals and pass app to getAuth

Removes broken '@firebase/util' async import, unused React 'use' import,
and the unused module-level Data array in the search API. Passes the
initialized app explicitly to getAuth(). No behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Environment documentation + final verification

**Files:**

- Create: `.env.example`

- [ ] **Step 1: Create `.env.example`**

```bash
# Firebase web config (client-side; safe to expose, but keep your own values).
# Get these from Firebase console → Project settings → Your apps → SDK setup.
NEXT_PUBLIC_APIKEY=
NEXT_PUBLIC_AUTHDOMAIN=
NEXT_PUBLIC_PROJECTID=
NEXT_PUBLIC_STORAGEBUCKET=
NEXT_PUBLIC_MESSAGINGSENDERID=
NEXT_PUBLIC_APPID=
NEXT_PUBLIC_MEASUREMENTID=
```

- [ ] **Step 2: Confirm `.env` stays ignored**

Run: `git check-ignore .env`
Expected: prints `.env` (already covered by `.gitignore`). Never commit a real `.env`.

- [ ] **Step 3: Full green-gate verification**

Run, in order, and confirm each succeeds:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all green. This is the Phase 0 definition of done.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example documenting Firebase env vars

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Definition of Done

- [ ] Clean checkout on Node 20 runs `npm ci` successfully.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass locally.
- [ ] CI workflow is present and passes the same five steps.
- [ ] The four safe cleanups are merged with no observable change to the running app (manual smoke: home loads, a search returns results, sign-in works — requires a real `.env`).
- [ ] A single ESLint config and a Prettier config exist; the codebase is formatted.
- [ ] `.env.example` documents all env vars; no secrets committed.

---

## Self-review notes (author)

- **Spec coverage:** every spec work-item (baseline, lint+format, TS baseline, testing harness, CI, safe cleanups, env docs) maps to a task (1–8 respectively). ✅
- **Deferred items honored:** no major upgrades, no Redux changes, no `head.tsx` migration, no bug fixes beyond inert cleanups. ✅
- **Env vars:** only the 7 real `NEXT_PUBLIC_*` Firebase vars are documented (grep-verified; Nodemailer unused). ✅
- **Naming consistency:** script names (`typecheck`, `format`, `format:check`, `test`, `test:watch`, `coverage`) are used identically in package.json, CI, and the DoD. ✅
