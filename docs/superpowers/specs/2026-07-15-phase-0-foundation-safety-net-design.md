# Phase 0 — Foundation & Safety Net (Design)

**Date:** 2026-07-15
**Project:** Yukirhythm (Next.js 14 App Router music/podcast player)
**Program:** Full rebuild-grade modernization (see roadmap below)
**Risk:** 🟢 Very low — no user-facing behavior changes

---

## Program roadmap (context)

This is the first of six phases. Each phase ships independently so the live app is never left half-upgraded.

| Phase | Name | Risk |
|-------|------|------|
| **0** | **Foundation & Safety Net** ← *this spec* | 🟢 Very low |
| 1 | Correctness & Bug Fixes | 🟢 Low |
| 2 | State & Data Architecture | 🟡 Medium |
| 3 | Dependency Modernization (Next 15 / React 19 / Firebase 11 / motion / HeroUI) | 🔴 Higher |
| 4 | Design Refresh & Polish | 🟡 Medium |
| 5 | Performance & Longevity | 🟢 Low |

**Decisions driving the program:** full rebuild-grade appetite; keep YouTube scraping but harden it; refresh & modernize the design; full safety net (strict TS, lint/format, unit tests, CI).

---

## Purpose of Phase 0

Before we fix bugs or upgrade anything risky, we build the **safety net** that will catch regressions during every later phase, and we establish a **reproducible, clean baseline**. Nothing a user can observe changes in this phase. Its whole job is to make Phases 1–5 safe.

## Goals

1. **Reproducible baseline** — a clean checkout installs and builds successfully on a documented Node version.
2. **One coherent lint + format setup** — replace the two conflicting ESLint configs; add Prettier.
3. **Automated tests** — Vitest + React Testing Library wired up, with a few real passing tests to prove the harness works.
4. **CI** — a GitHub Actions workflow that runs install → lint → typecheck → test → build on every push and PR.
5. **Safe, provably-inert cleanups** — remove broken/dead code that is a guaranteed no-op to remove.
6. **Documented configuration** — `.env.example` so a new contributor (or future you) can boot the app.

## Non-goals (explicitly deferred)

- **No dependency major-version upgrades** (Next/React/Firebase/etc. stay put — that's Phase 3).
- **No Redux/state refactor** (Phase 2).
- **No bug fixes or logic changes** beyond removing code that is provably inert (see "Safe cleanups").
- **No design/UI changes** (Phase 4).
- **No `head.tsx` → Metadata API migration** (a real bug, but scheduled for Phase 1/4 to keep Phase 0 zero-risk).

---

## Work items

### 1. Baseline verification
- `npm install` (or regenerate lockfile if the existing one is incompatible with the installed npm) and confirm `npm run dev`, `npm run build`, `npm start` succeed on the current stack.
- Pin the toolchain: add `.nvmrc` and an `engines.node` field to `package.json` documenting the supported Node version. (Dev machine runs Node 24; we verify the app builds on it and record the chosen supported version.)
- If the current stack does **not** build on the pinned Node, record the exact error and the minimal, non-major-version change needed to build. Anything requiring a major upgrade is escalated to Phase 3, not done here.

### 2. Lint + format
- **Consolidate to a single ESLint config.** Delete `.eslintrc.js` (Airbnb, references a typo'd `eslintreact/no-danger` rule, `ecmaVersion 12`) and keep/extend the Next-native `.eslintrc.json` (`next/core-web-vitals`). Add TypeScript-aware rules only as needed to keep the codebase passing.
- Add **Prettier**: `.prettierrc`, `.prettierignore`, and `format` / `format:check` scripts. Run a one-time format pass in its **own commit** so the noise is isolated from logic changes.
- Ensure `npm run lint` exits 0 on the whole repo.

### 3. TypeScript baseline
- Add a `typecheck` script: `tsc --noEmit`.
- Modernize `tsconfig.json` conservatively: bump `target` from `es5` → `ES2020`, refresh `lib`. Leave `moduleResolution` as-is to avoid resolution breakage (that's revisited in Phase 3).
- Make `tsc --noEmit` pass. Fix only **trivial** type errors (unused imports, obviously-wrong types). If a type error would require a logic change, insert a narrowly-scoped `// @ts-expect-error TODO(phase-N): <reason>` and log it in the plan rather than changing behavior now.

### 4. Testing harness
- Add **Vitest** + **@testing-library/react** + **jsdom** (dev dependencies) with `vitest.config.ts` and a `vitest.setup.ts`.
- Add scripts: `test`, `test:watch`, `coverage`.
- Write **2–3 real, passing tests** to prove the harness end-to-end — starting with pure logic that already exists (e.g. `lib/utils.ts` `cn`). No production code is refactored to make it testable in this phase; deeper test coverage arrives with each feature phase.

### 5. CI
- Add `.github/workflows/ci.yml` running on `push` and `pull_request`:
  `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.
- Use the pinned Node version. Cache npm. Build step uses dummy/public env values so it does not require real Firebase secrets (a `.env.ci` or workflow-level env with placeholder `NEXT_PUBLIC_*` values, since the build must not embed real secrets).

### 6. Safe cleanups (provably inert — no behavior change)
Each of these is verified to be a no-op by the build + tests:
- **`context/AuthContext.tsx:25`** — remove `import { async } from "@firebase/util";` (broken, unused import).
- **`context/AuthContext.tsx:1`** — remove the unused `use` import from React.
- **`pages/api/searchEngine.ts`** — remove the module-level `var Data` global and the two `Data = []` assignments (the variable is written but never read).
- **`config/firebase.ts`** — change `getAuth()` → `getAuth(app)` (strictly more correct; same runtime result with a single default app).
- Anything ambiguous about whether a change is inert is **deferred to Phase 1**, not done here.

### 7. Environment documentation
- Add `.env.example` listing every env var the app reads, with placeholder values and a one-line comment each:
  `NEXT_PUBLIC_APIKEY`, `NEXT_PUBLIC_AUTHDOMAIN`, `NEXT_PUBLIC_PROJECTID`, `NEXT_PUBLIC_STORAGEBUCKET`, `NEXT_PUBLIC_MESSAGINGSENDERID`, `NEXT_PUBLIC_APPID`, `NEXT_PUBLIC_MEASUREMENTID`, plus any Nodemailer vars discovered while scanning.
- Do **not** commit any real secret. Confirm `.env` is git-ignored (it is).

---

## New / changed files

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | new — CI pipeline |
| `vitest.config.ts` | new |
| `vitest.setup.ts` | new |
| `.prettierrc` / `.prettierignore` | new |
| `.eslintrc.js` | deleted |
| `.eslintrc.json` | kept, possibly extended |
| `.env.example` | new |
| `.nvmrc` | new |
| `package.json` | new scripts (`typecheck`, `format`, `format:check`, `test`, `test:watch`, `coverage`), `engines`, test/prettier devDeps |
| `tsconfig.json` | `target` es5 → ES2020, `lib` refresh |
| `context/AuthContext.tsx` | remove 2 dead imports |
| `pages/api/searchEngine.ts` | remove dead `Data` global |
| `config/firebase.ts` | `getAuth()` → `getAuth(app)` |
| test files | 2–3 smoke tests |

## Commit strategy

Small, reviewable commits so the safety net is auditable:
1. Baseline: `.nvmrc`, `engines`, verify build.
2. Tooling: ESLint consolidation + Prettier config + scripts.
3. One-time Prettier format pass (isolated, no logic).
4. Testing harness + smoke tests.
5. CI workflow.
6. Safe cleanups (dead imports/global, `getAuth(app)`).
7. `.env.example` + docs.

## Testing strategy

- **Automated:** the new Vitest smoke tests must pass.
- **Baseline gates (must all be green before Phase 0 is "done"):**
  - `npm ci` — clean install
  - `npm run lint` — 0 errors
  - `npm run typecheck` — 0 errors
  - `npm test` — all pass
  - `npm run build` — succeeds
  - CI workflow green on a test push/PR
- **Manual smoke:** `npm run dev`, load the home page, run a search, sign in — confirm nothing regressed from the safe cleanups. (Requires the real `.env`.)

## Success criteria

Phase 0 is complete when: a clean checkout on the pinned Node version installs, lints, typechecks, tests, and builds — all green in CI — and the safe cleanups are merged with no observable change to the running app.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Existing lockfile incompatible with installed npm | Regenerate lockfile; if that pulls major versions, pin to current majors and defer upgrades to Phase 3 |
| Pre-existing type errors under strict mode block `typecheck` | Fix trivial ones; scope-limited `@ts-expect-error` with a TODO for anything needing logic changes |
| The app doesn't build on the pinned Node without a dependency bump | Record the error; do the minimal non-major change, or escalate the specific package to Phase 3 |
| Prettier reformat creates a huge noisy diff | Isolate it in its own commit; no logic changes mixed in |
