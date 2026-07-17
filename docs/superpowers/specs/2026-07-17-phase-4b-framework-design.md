# Phase 4B — Next 16 + React 19 + ESLint 10 (Design)

**Date:** 2026-07-17
**Project:** Yukirhythm
**Branch:** `v2_2026`
**Risk:** 🔴 Highest of the program — the framework, the renderer, and the linter all move

---

## Goal

Move from Next 14 / React 18 / ESLint 8 to **Next 16 / React 19 / ESLint 10 (flat config)** with **no user-visible change**.

## Why this is safer than it sounds

Everything up to now was building the conditions for this:
- **41 tests**, including component smoke tests for Logo, controls, ListDrawer, Header, Hero, and the login form — written in 4A specifically as tripwires for *this* phase.
- **The dependency tree is clean** — Phase 2 deleted 18 unused packages, so there are far fewer peers to satisfy.
- **`moduleResolution: bundler`** is already in place (4A) — Next 16 wants it anyway.
- **CI is green and trustworthy**, and has already caught two failures local gates couldn't see.

## Reconnaissance (verified 2026-07-17, not assumed)

| Question | Answer |
|---|---|
| Does Next 16 force React 19? | **No** — `next@16.2.10` peers `react: ^18.2.0 \|\| ^19.0.0`. **The framework and renderer can move separately.** |
| Node floor for Next 16? | `>=20.9.0`. We're on 20; bump `.nvmrc` to **22 LTS** for headroom. |
| Do the Radix packages support React 19? | **Yes, already** — every installed `@radix-ui/*` peers `^16.8 \|\| ^17 \|\| ^18 \|\| ^19`. **No Radix bumps needed.** |
| Does `react-player@2.11` support React 19? | **Yes** — peer `>=16.6.0`. **It can stay on v2**; the risky v3 rewrite stays deferred to 4D. |
| `@testing-library/react@16.3`? | **Yes** — `^18 \|\| ^19`. |
| What blocks React 19? | Only **`vaul@0.9.2`** (`^16.8 \|\| ^17 \|\| ^18`) and **`sonner@1.5.0`** (`^18.0.0`). Both have React-19-ready latests. |
| ESLint coupling? | `eslint-config-next@15` allows `eslint ^7 \|\| ^8 \|\| ^9`; **`eslint-config-next@16` requires `eslint >=9`**. So flat config can land at **ESLint 9 on Next 15**, decoupled from the Next 16 jump. |
| Which files break on Next 15's async request APIs? | **Exactly one:** `app/profile/[id]/page.tsx` — `const Page = ({ params }: any)`, using `params.id` at lines 52, 57, 102, 116. No `cookies()`/`headers()`/`searchParams` usage anywhere. |

---

## Sub-steps

Each step isolates **one** concern and is independently gated + CI-verified. Today's repeated lesson is that couplings surprise you — so we don't bundle.

### 4B-1 — Next 14 → 15
- `npx @next/codemod@latest upgrade` to 15 (latest 15.x is **15.5.20**). **Review the codemod's diff — it's a starting point, not an authority.**
- Bump `eslint-config-next` → 15 (still allows ESLint 8, so lint doesn't move yet).
- **Fix the async request API** in `app/profile/[id]/page.tsx`: `params` becomes a `Promise`. It's a Client Component, so unwrap with React's `use()`:
  ```tsx
  const Page = ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = use(params);
  ```
  Replace the four `params.id` usages with `id`. **This also kills the `: any`** — type it properly.
- **React stays on 18.** ESLint stays on 8.

### 4B-2 — ESLint 8 → 9 + flat config
- Migrate `.eslintrc.json` → `eslint.config.mjs`. `eslint-config-next@15` permits ESLint 9, so this happens *without* touching Next again.
- 🎯 **Lint coverage must not shrink.** Phase 0 fixed a bug where `next lint` silently skipped `context/`, `config/`, `constants/`, `sections/`, `store/` — that's why `eslint.dirs` exists in `next.config.js`. **Prove coverage explicitly** (deliberately introduce a violation in a previously-unlinted directory and confirm lint reports it). A green lint run is not evidence.
- `next lint` is deprecated in newer Next; switching the script to `eslint .` is expected and fine.

### 4B-3 — Next 15 → 16
- Upgrade to `next@16` + `eslint-config-next@16` (which forces **ESLint 9 → 10**; that's fine, we're on 9 by now).
- Bump `.nvmrc` → **22**, `engines` → `>=20.9`, and the CI `node-version-file`. CI must match local.
- React still on 18. Review the codemod diff.

### 4B-4 — React 18 → 19
- `react` + `react-dom` → 19; `@types/react` + `@types/react-dom` → 19.
- **Forced peers:** `vaul` → 1.x, `sonner` → 2.x. Also `next-themes` → 0.4.x (0.2.1's peer is `*`, so npm won't complain — but a permissive range is not evidence of support; bump it deliberately).
- Radix and react-player stay put — verified compatible.
- React 19 notes for review: `ref` is now a regular prop (`forwardRef` still works); `propTypes`/`defaultProps` removed for function components; string refs gone. The codebase is small and modern, so exposure is expected to be low — **verify, don't assume**.

---

## Non-goals (explicitly deferred)

- **TypeScript 7** — 🚫 blocked and **not to be retried here.** `typescript@7.0.2`'s npm package is a **CLI-only shim** (`require("typescript")` exports only `version`/`versionMajorMinor`); every tool that reads the TS JS API breaks, Next included. This is *not* a Next-version problem, so Next 16 does not fix it. Re-verify the package exports before ever revisiting. **Staying on TypeScript 5.9.3.**
- **Tailwind 4** — 4C.
- **firebase 12, zod 4 + resolvers 5, tailwind-merge 3, react-player 3** — 4D.
- **No player behavior change, no design change, no new features.**
- **No `slice(0.2)` avatar fix** — a real bug, but it's a behavior change and has its own task.

---

## Testing strategy

- **The 4A smoke tests are the tripwire.** They must pass at every step. If Next 16 or React 19 breaks a component, they're what catches it.
- **Gate after every sub-step:** `lint`, `typecheck`, `test` (41), `build`. **CI green is the definition of done** — local `format:check` is unusable (Windows CRLF).
- ⚠️ **A dropping test count is a failure, not a win** — it means tests stopped being collected.
- **Manual smoke is mandatory** (automated tests cannot cover YouTube playback or visuals): home → search → add → play/pause → skip → volume → drawer → delete → sign in → **profile page (the async-params change!)** → liked songs → collections → theme toggle.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Two framework majors at once obscures the cause | Step through 15 → 16 separately; React moves in its own step |
| The async-params change breaks the profile page | It's the one known code change; the manual smoke explicitly covers `/profile/[id]` |
| **Flat-config migration silently reduces lint coverage** | Prove coverage by planting a violation in a previously-unlinted dir. This exact bug already happened once. |
| A codemod rewrites more than intended | Review every codemod diff before committing — a starting point, not an authority |
| React 19 breaks a UI library | Peers verified up front: only `vaul`/`sonner` block; Radix and react-player are already compatible |
| npm "resolves" a peer conflict by nesting duplicates (silent breakage) | Check `npm ls` for duplicate instances after each install — this bit us with ESLint 10 |
| Node 20 vs Next 16's 20.9 floor | Bump `.nvmrc` to 22 and keep CI in lockstep |

## Success criteria

Next 16, React 19, ESLint 10 with flat config, TypeScript 5.9.3. Lint coverage **provably** unchanged. 41 tests still passing. CI green on `v2_2026`. The app looks and behaves exactly as today — confirmed by owner smoke test, especially the profile page.
