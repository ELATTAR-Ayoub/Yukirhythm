# Phase 2 — The Great Cleanup (Design)

**Date:** 2026-07-16
**Project:** Yukirhythm
**Branch:** `v2_2026`
**Risk:** 🟢 Low — pure deletion, zero behavior change

---

## Goal

Delete everything the app doesn't use: dead dependencies, dead files, dead code, and config cruft. **Nothing a user can observe changes.** The app must behave byte-for-byte identically; it just stops carrying ~18 packages and ~500 lines it never runs.

This is deliberately a *deletion-only* phase. No upgrades, no refactors, no new features — so if anything breaks, the cause is unambiguous.

## Roadmap (revised)

| Phase | Name | Status |
|---|---|---|
| 0 | Foundation & Safety Net | ✅ shipped |
| 1 | Correctness & Bug Fixes (+ prod migration) | ✅ shipped |
| 2A | Monorepo + walking skeleton | ✅ shipped (Python service reverted; monorepo kept) |
| **2** | **The Great Cleanup** ← *this spec* | 🔨 |
| 3 | Redux → Zustand | queued |
| 4 | Upgrade the stack (Next 15, React 19, Firebase, TS, **Tailwind 4**, ESLint 9) | queued |
| 5 | API in Next (Route Handlers + Admin + Firestore rules lockdown) | queued |
| 6 | Design Refresh & Polish | queued |
| 7 | Performance & Longevity | queued |
| later | Flutter client · hardware client · Python agent service | future |

**Why cleanup before upgrades:** every dead package is a package we'd otherwise pay to upgrade, test, and migrate. Deleting `framer-motion` and `@nextui-org/react` outright removes two entire planned migrations. Every deletion here shrinks Phase 4.

**Why Zustand (3) before upgrades (4):** RTK is on v1 and we're replacing it anyway — no point upgrading RTK 1→2 just to delete it.

---

## Evidence

Everything below was verified by a repo-wide scan (grep for imports + config references, not guesswork). Config-only consumers (`tailwind.config.js`, `postcss.config.js`) were checked explicitly.

### A. Dead dependencies — remove from `apps/web/package.json`

**Zero imports anywhere:**

| Package | Note |
|---|---|
| `framer-motion` | appears **only** in package.json — the whole animation library is unused |
| `@nextui-org/react` | unused → **no HeroUI migration needed**, just delete |
| `gsap`, `gsap-trial` | both entirely unused |
| `@splinetool/react-spline`, `@splinetool/runtime` | 3D never wired up |
| `matter-js`, `@types/matter-js` | physics never wired up |
| `nodemailer`, `@types/nodemailer` | never imported |
| `node-fetch` | native `fetch` is used |
| `lucide-react` | all icons come from `@radix-ui/react-icons` |
| `@next/font` | deprecated **and** unused — fonts load via `@font-face` in `app/globals.css` |
| `postcss-nesting` | not registered in `postcss.config.js` |
| `redux`, `redux-thunk`, `redux-provider` | RTK bundles its own; `react-redux` provides `Provider` |
| `@types/tailwindcss` | obsolete — Tailwind 3 ships its own types |

**Deliberately NOT removed this phase:** `@reduxjs/toolkit`, `react-redux`, `next-redux-wrapper` — these are still imported by `store/`. They go in **Phase 3** with the Zustand migration, which is where the store is rewritten.

**Confirmed used — do not touch:** `@fabricio-191/youtube`, `firebase`, `firebase-admin`, `tsx`, `@opentelemetry/api`, `tailwindcss-animate`, `autoprefixer`, `react-player`, `sonner`, `vaul`, `next-themes`, `react-hook-form`, `zod`, `@hookform/resolvers`, `class-variance-authority`, `clsx`, `tailwind-merge`, all `@radix-ui/*`.

### B. Dead files — delete

| File | Evidence |
|---|---|
| `components/CursorFollower.tsx` | nothing imports it; it's a copy-paste of `Loader` (still `export default Loader`) |
| `components/SideBar.tsx` | nothing imports it |
| `components/Footer.tsx` | nothing imports it |
| `styles/cursor.css` | only ever imported by `CursorFollower.tsx` |
| `utils/motion.ts` | 215 lines of framer-motion variants; zero imports, and the library is being deleted |
| `pages/api/hello.ts` | untouched Next.js boilerplate |
| `toDo` | personal notes; its items are tracked in Phase 1 / the roadmap |

### C. Dead code — remove

- **`console.log`s:** `components/forms/signup.tsx:88,104`; `components/forms/login.tsx:62` (`console.log("sdd")`); `components/player/ListDrawer.tsx:117,126,133`; `context/AuthContext.tsx:206,218,282,285,359,385,390,395`.
  Keep genuine error reporting (`console.error` in catch blocks) and the CLI output in `scripts/migrate-users-to-uid.ts` (intentional, eslint-disabled).
- **Commented-out code blocks:** `components/Header.tsx:111-115`; `components/player/controls.tsx:240-249` (old range input superseded by `<Slider>`); `components/player/UserCollectionsList.tsx:282-290`; `components/Logo.tsx:29`.
- **Unused store exports** in `store/UIConfig.ts`: `setUIState` (unused **and** a no-op — `state = action.payload` doesn't mutate an Immer draft), `selectUIState`. After (B) deletes `Footer`/`CursorFollower`, `setLoading`/`selectLoading` also become unused — remove them too. **Keep** `setMenuToggle`/`selectMenuToggle` (used by `Header.tsx` and `app/profile/[id]/page.tsx`).

### D. Config cruft

- **`apps/web/tsconfig.json`** — `include` lists `pages/_app.js` and `sections/fallingWords.jsx`, **neither of which exists**. Also `components/Loader.tsx`, redundant with the `**/*.tsx` glob. Reduce `include` to the real globs.
- **`apps/web/next.config.js`** — remove the vestigial empty `experimental: {}` (keep `eslint.dirs`).
- **`.gitattributes` / `.gitignore`** — leave as-is (already correct).

---

## Non-goals (explicitly deferred)

- **No dependency upgrades** — Phase 4. Versions of surviving packages stay exactly as they are.
- **No Zustand / store rewrite** — Phase 3 (so `@reduxjs/toolkit`, `react-redux`, `next-redux-wrapper` survive this phase).
- **No API / Route Handlers / rules changes** — Phase 5.
- **No design or player changes** — Phase 6; the player is untouched.
- **No new features or tests beyond keeping the suite green.**

## Testing strategy

- **Gates:** `lint`, `format:check`, `typecheck`, `test` (19 passing), `build` — all green after **every** deletion batch, not just at the end.
- **CI:** must be green on `v2_2026`. (CI is the real check — local `format:check` shows Windows CRLF false-positives, which previously hid four genuinely unformatted files. Do not dismiss CI failures.)
- **Bundle sanity:** note `next build` output before/after; removing ~18 packages should not *increase* anything.
- **Manual smoke (owner, real `.env`):** home loads, search returns results, play/pause works, sign-in works, profile + liked songs + collections load, menu toggles.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| A "dead" package is actually used transitively or via config | Every package was grep-verified against source **and** config files; delete in small batches with a full build after each |
| Deleting a component breaks an import we missed | `typecheck` + `build` catch this immediately; batches keep the blast radius small |
| Removing `setLoading`/`selectLoading` breaks something | They're only imported by files being deleted in the same phase; typecheck confirms |
| Reformat noise swamps the diff | Deletions only; no format pass. If Prettier touches a file, that's a real finding |
| Windows CRLF hides a real `format:check` failure | Trust **CI**, not local `format:check` |

## Success criteria

~18 packages and ~500 lines gone; `apps/web/package.json` contains only packages that are actually imported (except the three Redux packages explicitly held for Phase 3); no dead files; no stray `console.log`s outside error handling and the CLI script; `tsconfig` `include` references only files that exist; **all gates and CI green**; and the running app is indistinguishable from before.
