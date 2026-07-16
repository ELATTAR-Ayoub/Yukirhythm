# Phase 4A — Strengthen the Net, Then Upgrade Tooling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add component smoke tests that will catch React 19 / Next 16 breakage in 4B, then upgrade the build-time tooling (TypeScript 7, ESLint 10 + flat config, Vitest 4 / Vite 7).

**Architecture:** Tests **first** — they're the tripwire for the risky phases. Then tooling, one concern per task, gating after each. No runtime dependency moves in this sub-phase (Next/React/Firebase/Tailwind are 4B–4D).

**Tech Stack:** Next.js 14 App Router, React 18, Vitest + Testing Library + jsdom, Zustand, Radix UI, `apps/web` in an npm-workspaces monorepo.

**Working branch:** `v2_2026` — commit directly to it, do NOT create a new branch.

**Context for the engineer:**
- Gates run from the **repo root**:
  ```bash
  npm run lint && npm run typecheck && npm test && npm run build
  ```
  ⚠️ `typecheck` enforces `noUnusedLocals`/`noUnusedParameters`.
  ⚠️ **Do NOT run `format:check` locally** — Windows CRLF false-positives make it useless. **Run `npx prettier --write` on every file you create**, because CI *will* fail on unformatted files (it has caught this twice already).
- `npm install` runs from the **ROOT** (workspaces; lockfile at root).
- The real `.env` is at `apps/web/.env` (gitignored) so `npm run build` works.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Current state: 29 tests in 6 files, all passing. Store is Zustand (`store/player.ts`, `usePlayerStore`). No Redux.

**Two hard constraints you must design around:**
1. **`config/firebase.ts` calls `initializeApp()` at MODULE SCOPE.** Any test importing a component that transitively imports it will try to boot Firebase with undefined env and throw. **Mock `@/context/AuthContext`** (which short-circuits the whole firebase import chain) rather than fighting it.
2. **Radix UI needs browser APIs jsdom lacks** (`ResizeObserver`, pointer capture, `scrollIntoView`). Task 1 adds those polyfills. Without them, anything rendering a Radix primitive (Slider, DropdownMenu, Dialog, Drawer) fails.

---

## Task 1: Test infrastructure + first component smoke test

**Files:** modify `apps/web/vitest.setup.ts`; create `apps/web/test/mocks.tsx`, `apps/web/components/Logo.test.tsx`.

- [ ] **Step 1: Add jsdom polyfills** — replace `apps/web/vitest.setup.ts` with:

```ts
import "@testing-library/jest-dom/vitest";

// jsdom lacks browser APIs that Radix UI primitives depend on. Without these,
// anything rendering a Slider/DropdownMenu/Dialog/Drawer throws.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined") {
  if (!("ResizeObserver" in window)) {
    window.ResizeObserver =
      ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
```

- [ ] **Step 2: Create shared mock helpers** — `apps/web/test/mocks.tsx`

```tsx
import { vi } from "vitest";

import type { User } from "@/constants/interfaces";

/** A blank signed-out user, matching the AuthContext default shape. */
export const emptyUser: User = {
  ID: "",
  docID: "",
  avatar: "",
  userName: "",
  email: "",
  marketingEmails: false,
  lovedSongs: [],
  collections: [],
  lovedCollections: [],
  followers: [],
  following: [],
};

export const signedInUser: User = {
  ...emptyUser,
  ID: "uid-1",
  docID: "uid-1",
  userName: "Tester",
  email: "t@example.com",
};

/**
 * Build a stub of the useAuth() context value. Mocking this module is what
 * keeps config/firebase.ts (which calls initializeApp at module scope) from
 * ever being imported during tests.
 */
export function makeAuthValue(user: User = emptyUser) {
  return {
    user,
    signin: vi.fn(),
    signup: vi.fn(),
    signupPopup: vi.fn(),
    signinPopup: vi.fn(),
    logout: vi.fn(),
    getUser: vi.fn(),
    likeAudio: vi.fn(),
    dislikeAudio: vi.fn(),
    addCollection: vi.fn(),
    likeCollection: vi.fn(),
    dislikeCollection: vi.fn(),
    getProfileUser: vi.fn().mockResolvedValue(user),
    getUserCollections: vi.fn().mockResolvedValue([]),
  };
}
```
NOTE: verify these keys against the real `useAuth()` value exported by `context/AuthContext.tsx` and adjust to match. Report any mismatch.

- [ ] **Step 3: Write the first component smoke test** — `apps/web/components/Logo.test.tsx`

`Logo` is the simplest real component (a `next/link` wrapping `SolidSvg`). It proves app components render at all.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Logo from "@/components/Logo";

describe("Logo", () => {
  it("renders a link to the home page", () => {
    render(<Logo />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});
```
**READ `components/SolidSVG.tsx` FIRST.** If it fetches the SVG or touches browser APIs jsdom lacks, either mock it in this test (`vi.mock("@/components/SolidSVG", () => ({ default: () => <span data-testid="svg" /> }))`) or adjust the assertion. Report what you found and what you did.

- [ ] **Step 4: Format, then run**

```bash
cd apps/web
npx prettier --write vitest.setup.ts test/mocks.tsx components/Logo.test.tsx
cd D:\Dev\YukiRythem\Yukirhythm
npm test
```
Expected: 30 tests (29 + 1). If `Logo` fails, fix the test or add the mock — do NOT change `Logo.tsx` itself.

- [ ] **Step 5: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add apps/web/vitest.setup.ts apps/web/test/mocks.tsx apps/web/components/Logo.test.tsx
git commit -m "test: add jsdom polyfills, shared auth mocks, and a first component test

Radix primitives need ResizeObserver/pointer-capture, which jsdom lacks.
Mocking AuthContext keeps firebase's module-scope initializeApp out of tests.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Smoke-test the player (the highest-value tests)

**Files:** create `apps/web/components/player/controls.test.tsx`, `apps/web/components/player/ListDrawer.test.tsx`.

The player is what must not break. These are the tests that matter most in 4B.

- [ ] **Step 1: READ both components fully first**

`components/player/controls.tsx` and `components/player/ListDrawer.tsx`. Note exactly what they import and what props/state they need. Do not write tests from assumption.

- [ ] **Step 2: Write `controls.test.tsx`**

`controls.tsx` renders a hidden `<ReactPlayer>`, transport `<Button>`s, and a Radix `<Slider>`, and reads `usePlayerStore`. Mock `react-player` (it's a heavy browser component) and `sonner`.

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Controls from "@/components/player/controls";
import { usePlayerStore } from "@/store/player";
import type { Audio } from "@/constants/interfaces";

vi.mock("react-player", () => ({
  default: () => <div data-testid="react-player" />,
}));

vi.mock("sonner", () => ({ toast: vi.fn() }));

const makeAudio = (id: string): Audio => ({
  ID: id,
  URL: `https://youtu.be/${id}`,
  title: `t-${id}`,
  thumbnails: [],
  owner: { name: "o", ID: "o", canonicalURL: "" },
});

describe("player controls", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      audioState: [],
      currentAudio: 0,
      audioLoading: false,
      audioPlaying: false,
      audioVolume: 0.4,
    });
  });

  it("renders without crashing when the queue is empty", () => {
    render(<Controls videoId="" />);
    expect(screen.getByTestId("react-player")).toBeInTheDocument();
  });

  it("renders transport controls with a queued track", () => {
    usePlayerStore.setState({ audioState: [makeAudio("a")] });
    render(<Controls videoId="a" />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
```
⚠️ Verify `Controls`' actual props — the plan assumes `videoId: string`. Read the component and match its real signature. If it renders `<ListDrawer>` internally and that pulls in `useAuth`, mock `@/context/AuthContext` here too using `makeAuthValue` from `@/test/mocks`.

- [ ] **Step 3: Write `ListDrawer.test.tsx`**

Follow the same pattern. `ListDrawer` uses `usePlayerStore` and `useAuth`, and renders a `vaul` Drawer + Radix pieces. Mock `@/context/AuthContext`:
```tsx
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => makeAuthValue(),
}));
```
Assert it mounts and (if the drawer content is lazily rendered) that its trigger exists. **Keep it a smoke test — do not test drawer interaction behavior.** The goal is "does it still mount under React 19", not full coverage.

- [ ] **Step 4: Format, run, gate, commit**

```bash
cd apps/web && npx prettier --write components/player/controls.test.tsx components/player/ListDrawer.test.tsx
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint && npm run typecheck && npm test && npm run build
git add apps/web/components/player/
git commit -m "test: smoke-test the player controls and list drawer

Tripwires for the React 19 / Next 16 upgrade.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Report the test count.

---

## Task 3: Smoke-test Header, Hero, and the login form

**Files:** create `apps/web/components/Header.test.tsx`, `apps/web/sections/Hero.test.tsx`, `apps/web/components/forms/login.test.tsx`.

- [ ] **Step 1: READ each component first** — `components/Header.tsx`, `sections/Hero.tsx`, `components/forms/login.tsx`. Mock exactly what each imports.

- [ ] **Step 2: `Header.test.tsx`**

`Header` calls `useAuth()` and renders a Radix DropdownMenu + Avatar. Mock AuthContext both signed-out and signed-in:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Header from "@/components/Header";
import { emptyUser, makeAuthValue, signedInUser } from "@/test/mocks";

const authValue = vi.hoisted(() => ({ current: {} as ReturnType<typeof Object> }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authValue.current,
}));

describe("Header", () => {
  it("renders the menu for a signed-out visitor", () => {
    authValue.current = makeAuthValue(emptyUser);
    render(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders for a signed-in user", () => {
    authValue.current = makeAuthValue(signedInUser);
    render(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});
```
NOTE: `<header>` maps to role `banner`. Adjust assertions to what the component actually renders. If `vi.hoisted` proves awkward, use a simpler per-test `vi.mock` with a fixed user — the goal is mounting, not elaborate state juggling.

- [ ] **Step 3: `Hero.test.tsx`**

`Hero` uses `usePlayerStore`, `toast`, `fetch` (`/api/searchEngine`), and renders the disc + search form + `<Controls>`. Mock `sonner`, `react-player`, and stub `global.fetch`. Assert it mounts and shows the search input.
Keep it a smoke test. Do **not** test the search flow end-to-end here.

- [ ] **Step 4: `login.test.tsx`**

`components/forms/login.tsx` uses react-hook-form + zod + `useAuth` + `next/navigation`. Mock `@/context/AuthContext` and `next/navigation`:
```tsx
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/login",
}));
```
Assert the email/password fields and submit button render. This test also becomes the tripwire for the **zod 4 / @hookform/resolvers 5** upgrade in 4D — valuable beyond 4B.

- [ ] **Step 5: Format, run, gate, commit**

```bash
cd apps/web && npx prettier --write components/Header.test.tsx sections/Hero.test.tsx components/forms/login.test.tsx
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint && npm run typecheck && npm test && npm run build
git add apps/web/components/Header.test.tsx apps/web/sections/Hero.test.tsx apps/web/components/forms/login.test.tsx
git commit -m "test: smoke-test Header, Hero, and the login form

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Report the final test count. **If any component genuinely cannot be smoke-tested without heavy contortion, STOP and report rather than writing a fake or trivially-passing test.** A test that asserts nothing is worse than no test.

---

## Task 4: TypeScript 5.2 → 7

**Files:** `apps/web/package.json`, possibly `apps/web/tsconfig.json`.

⚠️ TypeScript 7 is a **native (Go) rewrite**, not a routine bump. Treat it as an experiment with a defined fallback.

- [ ] **Step 1: Upgrade**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install --save-dev typescript@latest --workspace apps/web
```
Report the installed version.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: clean. If it errors:
- If errors are **genuine code issues**, fix them minimally (do not weaken `tsconfig`, do not add `any`/`@ts-ignore`).
- If errors are **TypeScript-7-rewrite artifacts** you cannot resolve cleanly (unsupported option, a compiler bug, tooling incompatibility), **STOP and report**. Per the spec, falling back to the latest 5.x/6.x is an acceptable outcome — but that's the controller's call, not yours. Report the exact errors.

- [ ] **Step 3: Verify the whole toolchain still agrees**

TypeScript is used by `next build`, `vitest`, and the editor. Run the full gate:
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
All must pass. `next build` runs its own type-checking — confirm it doesn't complain about the TS version.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): upgrade TypeScript to 7

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
(Include `tsconfig.json` if you had to touch it — and explain why in your report.)

---

## Task 5: ESLint 8 → 10 + flat config

**Files:** delete `apps/web/.eslintrc.json`; create `apps/web/eslint.config.mjs`; modify `apps/web/package.json`, possibly `apps/web/next.config.js`.

ESLint 9+ requires **flat config**. Current setup: `.eslintrc.json` = `{"extends": ["next/core-web-vitals", "prettier"]}`, and `next.config.js` has `eslint.dirs` listing the directories to lint.

- [ ] **Step 1: Upgrade the packages**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install --save-dev eslint@latest eslint-config-prettier@latest --workspace apps/web
```
Leave `eslint-config-next` alone for now — it's bumped with Next in 4B. **If ESLint 10 is incompatible with `eslint-config-next@14`, STOP and report**: the sane resolution is to do this task together with 4B, and that's the controller's call.

- [ ] **Step 2: Create `apps/web/eslint.config.mjs`**

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
You'll need `@eslint/eslintrc` and `@eslint/js` as devDependencies for `FlatCompat`:
```bash
npm install --save-dev @eslint/eslintrc @eslint/js --workspace apps/web
```
NOTE: if `eslint-config-next` ships a native flat config in the installed version, prefer that over `FlatCompat` and drop the compat packages. Check its docs/exports first and report which route you took.

- [ ] **Step 3: Delete the old config**

```bash
git rm apps/web/.eslintrc.json
```

- [ ] **Step 4: Make lint cover the same directories as before**

`next.config.js`'s `eslint.dirs` lists: app, pages, components, lib, context, config, constants, sections, store, `__tests__`. Confirm flat config still lints all of them (flat config globs from the project root by default, which should cover more, not less). Verify by checking the lint output mentions files across those directories.
**Do not silently reduce lint coverage** — that's the exact bug Phase 0 fixed.

- [ ] **Step 5: Gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
`npm run lint` is `next lint`. **Note:** newer Next versions deprecate `next lint` in favour of calling `eslint` directly. If `next lint` doesn't work with flat config in Next 14, change the script to `eslint .` and report the change.
Expected: 0 errors (pre-existing warnings are fine).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(lint): upgrade to ESLint 10 with flat config

Replaces .eslintrc.json with eslint.config.mjs. Lint coverage unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Vitest 2 → 4, Vite 5 → 7, and types

**Files:** `apps/web/package.json`, possibly `apps/web/vitest.config.ts`.

- [ ] **Step 1: Upgrade**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install --save-dev vitest@latest @vitest/coverage-v8@latest vite@latest @vitejs/plugin-react@latest @types/node@22 --workspace apps/web
```
⚠️ **`vite-tsconfig-paths`**: Phase 0 pinned it to 4.3.2 because 5.x is ESM-only and this package has no `"type": "module"`. Try `vite-tsconfig-paths@latest`; if it reproduces the "resolved to an ESM file" failure, **stay on 4.3.2** and say so in your report. Do NOT add `"type": "module"` to `apps/web/package.json` to force it — that would ripple through the whole app.

- [ ] **Step 2: Run the tests**

```bash
npm test
```
Expected: all tests pass (the count from Task 3). Vitest 4 may have changed config/API surface — if `vitest.config.ts` needs updating, do it minimally and report what changed.

- [ ] **Step 3: Full gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/vitest.config.ts
git commit -m "chore(deps): upgrade Vitest, Vite, and @types/node

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Push and prove CI green

- [ ] **Step 1: Full gate + push**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint && npm run typecheck && npm test && npm run build
git push origin v2_2026
```

- [ ] **Step 2: Confirm CI green — the real gate**

```bash
gh run list --branch v2_2026 --limit 1
```
Poll until `completed`, then `gh run view <run-id>`.
**`format:check` runs only in CI** — if it fails, run `npx prettier --write` on the named files, commit, push again.
CI green is the definition of done.

- [ ] **Step 3: Report**

Report: final test count, versions installed (TypeScript, ESLint, Vitest, Vite), whether `vite-tsconfig-paths` could be upgraded, any fallback taken, and the CI run URL.

---

## Definition of Done

- [ ] Component smoke tests exist for Logo, controls, ListDrawer, Header, Hero, and the login form — **real assertions, not trivially-passing stubs**.
- [ ] jsdom polyfills for Radix are in `vitest.setup.ts`; shared auth mocks in `test/mocks.tsx`.
- [ ] TypeScript on 7 (or a documented fallback with reasons).
- [ ] ESLint on 10 with flat config; **lint coverage not reduced**.
- [ ] Vitest/Vite/@types/node current.
- [ ] All gates + **CI green on `v2_2026`**.
- [ ] **No runtime dependency moved** (Next/React/Firebase/Tailwind/react-player untouched — those are 4B–4D).
- [ ] No app behavior change.

## Self-review notes (author)

- **Spec coverage:** 4A item 1 (smoke tests) → Tasks 1–3; item 2 (TS/ESLint/Vitest/Vite/types) → Tasks 4–6; `vite-tsconfig-paths` question → Task 6 Step 1; CI → Task 7. ✅
- **Tests come first, deliberately** — they're the tripwire 4B depends on. Tooling upgrades follow so any fallout lands against a stronger net.
- **The two known landmines are encoded:** firebase's module-scope `initializeApp` (mock AuthContext) and Radix's jsdom gaps (polyfills in Task 1).
- **Honest limitation:** I have not read `SolidSVG.tsx`, `ListDrawer.tsx`, `Hero.tsx`, or `login.tsx` in full, so each test task says **read the component first and match its real API** rather than trusting my sketch. Better an explicit instruction than a confidently-wrong snippet.
- **Explicit stop conditions** where a subagent shouldn't improvise: TS 7 rewrite fallout (Task 4), ESLint 10 × eslint-config-next 14 incompatibility (Task 5), untestable components (Task 3) — all escalate to the controller.
