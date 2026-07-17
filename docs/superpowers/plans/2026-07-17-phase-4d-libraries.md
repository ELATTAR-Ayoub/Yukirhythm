# Phase 4D — Remaining Libraries Implementation Plan (*finishes Phase 4*)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade every remaining outdated package, closing Phase 4. Zero user-visible change.

**Architecture:** Cheapest/safest first, riskiest last — `tailwind-merge`+types → `firebase` → `zod` → `react-player`. Each is gated and committed alone, so `react-player` (the only item that can genuinely break the app) is attempted when nothing else is in flight and a stop costs nothing.

**Tech Stack:** Next 16, React 19, Tailwind 4, TypeScript 5.9.3, ESLint 9, Vitest 4, Zustand 5, Firebase 10→12, `apps/web` in an npm-workspaces monorepo.

**Working branch:** `v2_2026` — commit directly to it.

**Context for the engineer:**
- Gates from the **repo root**: `npm run lint && npm run typecheck && npm test && npm run build`
- **41 tests in 12 files** must stay passing. ⚠️ A dropping count is a FAILURE.
- ⚠️ **Do NOT run `format:check` locally** (Windows CRLF false-positives). Run `npx prettier --write` on files you touch. CI is the real gate.
- ⚠️ **NEVER `git add -A`** — 19 untracked owner fonts in `apps/web/public/fonts/{offbit,satoshi}/` must NOT be committed. **Stage explicit paths**; check `git status --short` first.
- `npm install` from the **ROOT** with `--workspace apps/web`. ⚠️ **After every install, verify on disk** (`ls apps/web/node_modules/<pkg> 2>/dev/null` should be absent if hoisted) — `npm ls` has twice reported "deduped" while a nested duplicate existed (ESLint, React). If nested, `npm dedupe` from the root.
- Real `.env` at `apps/web/.env` so `npm run build` works.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

**🚫 HARD RULES**
- **Do NOT touch `typescript` (5.9.3) or `eslint` (9.39.5).** Both are blocked upstream with verified evidence — Task 5 re-checks them properly. Do NOT force either with npm `overrides`; that asserts compatibility that demonstrably does not exist.
- **Do NOT change player behaviour.** Whatever react-player version we land on must behave exactly as today.
- **Do NOT touch the Firestore data model** — prod is uid-keyed and already migrated.
- **Do NOT fix** the `slice(0.2)` avatar bug or the React Compiler `warn` findings — separate tasks.
- **Do NOT delete or weaken a test.**
- Do NOT swap the YouTube engine (`@fabricio-191/youtube` stays).

---

## Task 1: `tailwind-merge` 3 + `@types/node` 26

**Files:** `apps/web/package.json`, root `package-lock.json`

Cheapest first. `tailwind-merge` is used **only** by `cn()` in `lib/utils.ts` — and `lib/utils.test.ts` already asserts real merge behaviour (`cn("px-2","px-4") === "px-4"`), so it's a genuine tripwire.

- [ ] **Step 1: Upgrade**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install tailwind-merge@3 --workspace apps/web
npm install --save-dev @types/node@26 --workspace apps/web
npm ls tailwind-merge
```
Report versions + peer warnings. Verify no nested duplicates on disk.

- [ ] **Step 2: Gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green, **41 tests**, 7 routes.
🎯 **`lib/utils.test.ts` must still pass** — tailwind-merge 3 is tuned for Tailwind 4 (we're on 4.3.3, so this is the *correct* pairing; v2 was tuned for Tailwind 3). If a merge assertion fails, report the exact case — that's a real behaviour change worth knowing.

- [ ] **Step 3: Commit**

```bash
git status --short
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): upgrade tailwind-merge to 3 and @types/node to 26

tailwind-merge 3 is the version tuned for Tailwind 4.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `firebase` 10 → 12

**Files:** `apps/web/package.json`, root `package-lock.json`, possibly `apps/web/config/firebase.ts` / `apps/web/context/AuthContext.tsx`

Two majors, but our surface is small and entirely the **modular** API (stable across 10→12).

**The complete Firebase surface in use** (verified by grep — nothing else):
- `firebase/app`: `initializeApp`
- `firebase/auth`: `getAuth`, `onAuthStateChanged`, `signInWithPopup`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `updateProfile`, `GoogleAuthProvider`, `FacebookAuthProvider`
- `firebase/firestore`: `getFirestore`, `doc`, `getDoc`, `setDoc`, `updateDoc`, `runTransaction`, `arrayUnion`, `arrayRemove`, `increment`, `collection`, `addDoc`, `getDocs`, `query`, `where`

- [ ] **Step 1: Upgrade**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install firebase@12 --workspace apps/web
npm ls firebase
```
Report the version + ALL peer warnings. Verify no nested duplicate on disk.
NOTE: `firebase-admin@14` (devDep, used only by the migration script) is separate and already current — **do not touch it**.

- [ ] **Step 2: Typecheck — this is the real check**

```bash
npm run typecheck
```
TypeScript will catch any signature drift across the 14 functions above. Fix genuine errors **minimally** — no `any`, no `@ts-ignore`, no tsconfig weakening.
**If a fix requires changing auth or data logic, STOP and report** — that's not a dependency bump.

- [ ] **Step 3: Gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green, **41 tests**, 7 routes.
⚠️ Our tests **mock** `@/context/AuthContext`, so they do **not** exercise real Firebase. Typecheck + build are the automated signal; the owner's manual sign-in is the real one. Say so in your report rather than implying the tests validate Firebase.

- [ ] **Step 4: Commit**

```bash
git status --short
git add apps/web/package.json package-lock.json <plus any source you had to fix>
git commit -m "chore(deps): upgrade Firebase to 12

Modular API surface unchanged: auth (popup/email/state) and Firestore
(doc/getDoc/setDoc/updateDoc/runTransaction/arrayUnion/increment).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `zod` 3 → 4 + `@hookform/resolvers` 3 → 5

**Files:** `apps/web/package.json`, root `package-lock.json`, possibly the 3 form files

They move together. `react-hook-form` is already **7.81.0**, satisfying `@hookform/resolvers@5`'s `^7.55.0` peer — **no react-hook-form bump needed**.

**The complete zod surface** (3 schemas, all simple):
- `components/forms/login.tsx:29` — `z.object({ email: z.string().min(10, {message}), password: z.string().min(6, {message}) })`
- `components/forms/signup.tsx:29` — `username`/`email`/`password`, same shape
- `components/forms/addCollection.tsx:38` — `title`/`desc`/`tags`, `.min(n, { message })`
All use `zodResolver(formSchema)` from `@hookform/resolvers/zod`.

- [ ] **Step 1: Upgrade both together**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install zod@4 @hookform/resolvers@5 --workspace apps/web
npm ls zod @hookform/resolvers react-hook-form
```
Report versions + peer warnings. Verify no nested duplicates.

- [ ] **Step 2: Typecheck + check the error-customisation API**

```bash
npm run typecheck
```
zod 4 changed error customisation from `{ message: "..." }` to `{ error: "..." }`. `message` may still work (deprecated) — **verify against the installed zod's types rather than assuming**. If it still works, **leave the schemas alone** (this phase is not a refactor). If it's a hard error, update the 3 schemas to the new form, preserving **the exact same message strings**.
Also: `zodResolver`'s import path may have changed in resolvers 5 — verify `@hookform/resolvers/zod` still resolves.

- [ ] **Step 3: Gate — `login.test.tsx` is the tripwire**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green, **41 tests**, 7 routes.
🎯 `components/forms/login.test.tsx` was written in 4A **for exactly this upgrade** — it asserts the email/password fields resolve via `getByLabelText`/`getByPlaceholderText`, which only works if `useForm` + `zodResolver` register the fields correctly. **If it fails, the resolver wiring broke** — investigate, don't delete it.

- [ ] **Step 4: Commit**

```bash
git status --short
git add apps/web/package.json package-lock.json <plus any schema files you had to change>
git commit -m "chore(deps): upgrade zod to 4 and @hookform/resolvers to 5

react-hook-form 7.81 already satisfies resolvers@5's ^7.55 peer.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `react-player` 2 → 3 — **attempt with a hard stop**

**Files:** `apps/web/package.json`, root `package-lock.json`, `apps/web/components/player/controls.tsx`

⚠️ **This is the highest-risk item in Phase 4, and the only one that can break something users feel immediately.**

**Read this before touching anything:**
- **v3 is a ground-up rewrite** that realigns the API to the HTML5 media element.
- **v2.16.1 already works on React 19** (peer `>=16.6.0`). **v3 is not blocking anything** — no security, correctness, or compatibility reason forces it. The only argument is "be current."
- **Our tests MOCK react-player** (`controls.test.tsx`, `ListDrawer.test.tsx`), so **they are nearly blind to a v3 API break.** A green test run proves almost nothing here. **Manual playback verification is the only real check.**

**The full v2 surface `controls.tsx` uses** (all must keep working identically):
```
url={youtubeUrl} · loop={looping} · playing={playing} · volume={volume}
width={0} · height={0}
config={{ youtube: { playerVars: { showinfo, modestbranding, playsinline,
  controls, rel, fs, disablekb, iv_load_policy, autohide, loop, mute,
  progressInterval } } }}
onReady · onBuffer · onBufferEnd · onError · onPlay · onPause · onEnded
onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
onDuration={(duration) => setDuration(duration)}
playerRef.current?.seekTo(time)   // via the Slider
```
**Phase 1 behaviour that must survive:** the buffering spinner (`onBuffer`/`onBufferEnd` → `setLoading`), unplayable-video handling (`onError` → toast + skip to next), `onEnded` → advance, slider seek, volume.

- [ ] **Step 1: Install and READ THE SHIPPED TYPES — do not migrate from memory**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install react-player@3 --workspace apps/web
```
Then **read the actual API** from what shipped:
```bash
find apps/web/node_modules/react-player node_modules/react-player -name "*.d.ts" 2>/dev/null | head
cat node_modules/react-player/README.md 2>/dev/null | head -80
```
**Produce an explicit mapping table** of every v2 prop above → its v3 equivalent (or "removed / no equivalent"). Report it **before** editing `controls.tsx`.
🎯 **If any of these has no v3 equivalent — especially the `config.youtube.playerVars` block or `seekTo` — STOP and report the mapping.** Do not invent a workaround.

- [ ] **Step 2: Port `controls.tsx`**

Only if Step 1's mapping is complete and unambiguous. Port each prop/handler to its v3 equivalent, preserving behaviour exactly. Do NOT change any surrounding logic (`handleOnEnded`, `skipAudio`, `handleError`, the spinner, the Slider).

- [ ] **Step 3: Gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: green, **41 tests**, 7 routes. **Remember the tests mock react-player — green here is weak evidence.**

- [ ] **Step 4: 🎯 Verify playback for real — the actual gate**

The tests cannot do this. Start the dev server and confirm by hand:
```bash
# .claude/launch.json has a "web-tw4-verify" entry on port 3101
```
Verify: a track plays · pause/resume · skip next/prev · the slider seeks · volume changes · the buffering spinner appears then clears · an unplayable video toasts and skips.
**If you cannot verify playback in this environment, say so plainly and report Step 1's mapping + the diff for the controller to hand to the owner. Do NOT claim it works.**

- [ ] **Step 5: Commit — OR revert**

**If playback is verified identical:**
```bash
cd apps/web && npx prettier --write components/player/controls.tsx
cd D:\Dev\YukiRythem\Yukirhythm
git status --short
git add apps/web/package.json package-lock.json apps/web/components/player/controls.tsx
git commit -m "feat(player): upgrade react-player to 3

Ports controls.tsx to v3's HTML5-media-aligned API. Playback, buffering
spinner, error-skip, seek, and volume verified unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**If the port can't preserve behaviour, or the mapping is incomplete — REVERT and document:**
```bash
npm install react-player@2 --workspace apps/web
git checkout -- apps/web/components/player/controls.tsx
npm run lint && npm run typecheck && npm test && npm run build
git status --short
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): stay on react-player 2

react-player 3 is a rewrite of the API controls.tsx depends on: <specifics>.
v2.16.1 supports React 19, so nothing is blocked. Porting would re-engineer
the player -- the one component whose breakage users feel immediately -- for
no functional gain. Revisit if v2 loses React support.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
(Fill in `<specifics>` from Step 1's mapping.) **This is an explicitly acceptable, planned outcome — not a failure.** Report it as such.

---

## Task 5: Re-verify the blocked upgrades, then push

**Files:** none (verification only)

- [ ] **Step 1: Re-check TypeScript 7 — one command, no guessing**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
node -e "const ts=require('typescript'); console.log('installed:', ts.version, '| exports:', Object.keys(ts).length)"
npm view typescript version
node -e "const p=require('child_process'); " 2>/dev/null
```
Then check whether the **published** TS 7 still lacks the JS API:
```bash
npm view typescript@latest main
```
Expected: `undefined` (CLI-only shim) → **still blocked, stay on 5.9.3**. If `main` now points at a real entry, report it — that would mean TS 7 became adoptable.

- [ ] **Step 2: Re-check ESLint 10**

```bash
npm view eslint-plugin-react peerDependencies.eslint
npm view eslint-plugin-import peerDependencies.eslint
npm view eslint-plugin-jsx-a11y peerDependencies.eslint
```
Expected: none list `^10` → **still blocked, stay on ESLint 9**. If all three now support 10, report it.
**Do NOT attempt the upgrade in this task** — just report the facts.

- [ ] **Step 3: Confirm nothing else is outdated**

```bash
npm outdated --workspace apps/web
```
Expected: **only `typescript` and `eslint`** remain (plus `react-player` if Task 4 reverted). Anything else outdated means we missed it — report it.

- [ ] **Step 4: Full gate + push**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git status --short   # fonts must NOT be staged
git push origin v2_2026
```

- [ ] **Step 5: Confirm CI green**

```bash
gh run list --branch v2_2026 --limit 1
```
Poll until complete, then `gh run view <run-id>`. CI runs `format:check`, which local runs can't. **CI green is the definition of done.**

- [ ] **Step 6: Report**

Final versions of everything; the react-player decision (ported or reverted) **with the mapping table**; the TS 7 / ESLint 10 re-check results; `npm outdated` output; the CI run URL.

---

## Definition of Done

- [ ] `firebase` 12, `zod` 4, `@hookform/resolvers` 5, `tailwind-merge` 3, `@types/node` 26.
- [ ] `react-player` either **on 3 with playback verified by hand**, or **on 2 with a documented reason** — both acceptable.
- [ ] `npm outdated` shows only `typescript` + `eslint`, each with a **re-verified** upstream blocker.
- [ ] **41 tests** passing; none deleted or weakened.
- [ ] **CI green on `v2_2026`.**
- [ ] No fonts committed; no data-model change; no player behaviour change.

## Owner smoke test (mandatory — the tests mock Firebase AND react-player)

`npm run dev`, then: **sign in** (firebase 12) → search → add a track → **play / pause / skip / seek / volume** (react-player) → an unplayable video toasts and skips → **like/unlike** a song and a collection (Firestore writes) → **create a collection** (zod 4 + resolvers 5) → submit login/signup with bad input and confirm **validation errors still render** (zod 4).

## Self-review notes (author)

- **Spec coverage:** all six upgrades → Tasks 1–4; blocked-upgrade re-verification → Task 5; CI → Task 5. ✅
- **Ordering is the risk control:** cheapest first, `react-player` last and alone, so a stop there costs nothing else.
- **Honest about test blindness — twice**, because it would be easy to imply otherwise: the tests mock `AuthContext` (so they don't validate Firebase) and mock `react-player` (so they don't validate playback). Only `login.test.tsx` (zod) and `lib/utils.test.ts` (tailwind-merge) are genuine tripwires here.
- **The react-player revert is pre-written as a first-class outcome**, with its own commit message — so "keep v2" is a decision the plan already endorses, not a subagent improvising under pressure.
- **Blocked upgrades get re-verified, not assumed** — each is a one-command check, so this doesn't calcify into folklore.
