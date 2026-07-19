# Deck Carousel 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/deck-lab` preview page with a cinematic Three.js vinyl deck — 80s anime retrotech look, GSAP-choreographed realistic disc swaps on next/previous, retro post-processing.

**Architecture:** New components live beside the existing prototype under `apps/web/components/studio/deck/` and never touch it. Pure math (slots, index wrap, seat rotation) is extracted into testable modules. All transform animation is owned by a single GSAP choreography hook that manipulates Three.js objects through a handle registry; React state only tracks `current`, `phase`, `glitch`. Post-processing is a `@react-three/postprocessing` composer.

**Tech Stack:** Next 14 (app router), React 18.2, @react-three/fiber ^8, @react-three/drei ^9, three ^0.170, gsap ^3, @react-three/postprocessing ^2, vitest + testing-library.

**Working directory:** the isolated worktree `D:\Dev\YukiRythem\Yukirhythm\.claude\worktrees\deck-carousel` on branch `v2-deck-carousel`. Run all commands from that directory. All file paths below are relative to it.

**Conventions to know:**
- npm workspaces monorepo — install with `npm install --workspace apps/web <pkg>`, run scripts with `npm run <script> -w apps/web`.
- Existing types you will reuse: `DeckTrack` from `apps/web/components/studio/DiscDeck.tsx` (`{ title, artist, texture?, artUrl? }`). Always set `artUrl` in mock data (avoids the `TextureName` union).
- Existing UI atoms you will reuse: `PlayerButton` (`apps/web/components/studio/PlayerButton.tsx`), `IconSwap` (`apps/web/components/studio/IconSwap.tsx`), typography classes `type-h4`, `type-label`, color class `bg-ink`.
- Brand palette: ink `#191919`, blue `#1450F0`, green `#7DF08A`, paper `#F7F6F3`.

---

### Task 1: Install animation + post-processing dependencies

**Files:**
- Modify: `apps/web/package.json` (via npm)
- Modify: `package-lock.json` (via npm)

- [ ] **Step 1: Install**

```bash
npm install --workspace apps/web gsap@^3.12.5 @react-three/postprocessing@^2.16.3
```

`@react-three/postprocessing` must stay on the **v2** line — v3 requires fiber 9 / React 19, and this branch is React 18.2 with fiber 8.

- [ ] **Step 2: Verify resolution**

```bash
npm ls gsap @react-three/postprocessing --workspace apps/web
```

Expected: `gsap@3.12.x` and `@react-three/postprocessing@2.16.x`, no `invalid`/`missing` markers.

- [ ] **Step 3: Typecheck still clean**

```bash
npm run typecheck -w apps/web
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): add gsap and @react-three/postprocessing for deck carousel"
```

---

### Task 2: Slot math module (TDD)

Pure module answering "which slot does disc *i* occupy when track *current* plays" plus the transform of each slot. The choreography and the components both read from here — single source of truth.

**Files:**
- Create: `apps/web/components/studio/deck/slots.ts`
- Test: `apps/web/components/studio/deck/slots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/components/studio/deck/slots.test.ts
import { describe, expect, it } from "vitest";

import { SLOTS, slotFor } from "./slots";

describe("slotFor", () => {
  it("places current at center, successor right, predecessor left", () => {
    expect(slotFor(0, 0, 5)).toBe("center");
    expect(slotFor(1, 0, 5)).toBe("right");
    expect(slotFor(4, 0, 5)).toBe("left");
    expect(slotFor(2, 0, 5)).toBe("hidden");
    expect(slotFor(3, 0, 5)).toBe("hidden");
  });

  it("wraps around the ends of the queue", () => {
    expect(slotFor(4, 4, 5)).toBe("center");
    expect(slotFor(0, 4, 5)).toBe("right");
    expect(slotFor(3, 4, 5)).toBe("left");
  });

  it("handles a two-track queue without a left slot", () => {
    expect(slotFor(0, 0, 2)).toBe("center");
    expect(slotFor(1, 0, 2)).toBe("right");
  });

  it("handles a single track and an empty queue", () => {
    expect(slotFor(0, 0, 1)).toBe("center");
    expect(slotFor(0, 0, 0)).toBe("hidden");
  });
});

describe("SLOTS", () => {
  it("defines a transform for every slot", () => {
    for (const key of ["center", "left", "right", "hidden"] as const) {
      expect(SLOTS[key].pos).toHaveLength(3);
      expect(typeof SLOTS[key].rotY).toBe("number");
      expect(SLOTS[key].scale).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/web -- slots
```

Expected: FAIL — cannot resolve `./slots`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/components/studio/deck/slots.ts
export type Slot = "center" | "left" | "right" | "hidden";

export interface SlotTransform {
  pos: [number, number, number];
  rotY: number;
  scale: number;
}

// Frontal composition from the owner's sketch: the center disc faces the
// viewer on the platter, neighbours hover tilted at the sides.
export const SLOTS: Record<Slot, SlotTransform> = {
  center: { pos: [0, 0, 0], rotY: 0, scale: 1 },
  left: { pos: [-3.05, 0, -0.9], rotY: 1.05, scale: 0.86 },
  right: { pos: [3.05, 0, -0.9], rotY: -1.05, scale: 0.86 },
  hidden: { pos: [0, -0.6, -4.2], rotY: 0, scale: 0.15 },
};

/** Which slot disc `i` occupies when track `current` is on the platter. */
export function slotFor(i: number, current: number, n: number): Slot {
  if (n <= 0) return "hidden";
  const o = (((i - current) % n) + n) % n;
  if (o === 0) return "center";
  if (o === 1) return "right";
  if (o === n - 1 && n > 2) return "left";
  return "hidden";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/web -- slots
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/deck/slots.ts apps/web/components/studio/deck/slots.test.ts
git commit -m "feat(deck): slot assignment math for the carousel"
```

---

### Task 3: Choreography math helpers (TDD)

Two pure helpers the timeline needs: wrap-around index stepping, and the "seat rotation" — the incoming disc turns at least one extra full revolution and lands label-upright.

**Files:**
- Create: `apps/web/components/studio/deck/choreography-math.ts`
- Test: `apps/web/components/studio/deck/choreography-math.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/components/studio/deck/choreography-math.test.ts
import { describe, expect, it } from "vitest";

import { nextIndex, seatRotation } from "./choreography-math";

const TAU = Math.PI * 2;

describe("nextIndex", () => {
  it("steps forward and wraps", () => {
    expect(nextIndex(0, "next", 5)).toBe(1);
    expect(nextIndex(4, "next", 5)).toBe(0);
  });

  it("steps backward and wraps", () => {
    expect(nextIndex(0, "prev", 5)).toBe(4);
    expect(nextIndex(3, "prev", 5)).toBe(2);
  });
});

describe("seatRotation", () => {
  it("adds one full extra turn from an aligned start", () => {
    expect(seatRotation(0)).toBeCloseTo(TAU);
    expect(seatRotation(TAU)).toBeCloseTo(2 * TAU);
  });

  it("always lands on a multiple of a full turn, at least one turn ahead", () => {
    for (const start of [0.3, 2.5, 7.1, 40.0]) {
      const target = seatRotation(start);
      expect(target % TAU).toBeCloseTo(0);
      expect(target - start).toBeGreaterThanOrEqual(TAU * 0.99);
      expect(target - start).toBeLessThan(TAU * 2);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/web -- choreography-math
```

Expected: FAIL — cannot resolve `./choreography-math`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/components/studio/deck/choreography-math.ts
const TAU = Math.PI * 2;

export type SwapDirection = "next" | "prev";

/** Wrap-around track index after a swap. */
export function nextIndex(
  current: number,
  dir: SwapDirection,
  n: number
): number {
  return (current + (dir === "next" ? 1 : -1) + n) % n;
}

/**
 * Rotation target that seats an incoming disc: from wherever its face
 * currently points, turn at least one extra full revolution and land
 * label-upright (a multiple of a full turn).
 */
export function seatRotation(currentRotation: number): number {
  return Math.ceil(currentRotation / TAU) * TAU + TAU;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/web -- choreography-math
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/deck/choreography-math.ts apps/web/components/studio/deck/choreography-math.test.ts
git commit -m "feat(deck): pure choreography helpers — index wrap and seat rotation"
```

---

### Task 4: Disc component

One vinyl record. The choreography owns the outer `root` group (position/rotation/scale); the disc itself only owns its motor spin (with inertia) and a hover bump on a **separate** inner group so hover never fights GSAP.

**Files:**
- Create: `apps/web/components/studio/deck/Disc.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/components/studio/deck/Disc.tsx
"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";

import { SLOTS, slotFor } from "./slots";

export const DISC_R = 1.5;
const SPIN_SPEED = 3.1; // rad/s — stylised 33rpm

export interface DiscHandle {
  /** Slot transform — owned exclusively by the choreography timeline. */
  root: THREE.Group;
  /** Rotation about the face axis — motor spin + seat rotation. */
  spinner: THREE.Group;
}

/** Procedural vinyl groove bump map (canvas-generated once). */
export function useGrooveTexture() {
  return useMemo(() => {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2;
    for (let r = size * 0.17; r < size * 0.5; r += 2.2) {
      const shade = 100 + Math.floor(Math.random() * 56);
      ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const r = size * (0.22 + 0.26 * Math.random());
      ctx.strokeStyle = "rgb(48,48,48)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

interface DiscProps {
  index: number;
  current: number;
  n: number;
  labelMap: THREE.Texture;
  grooves: THREE.Texture;
  playing: boolean;
  register: (index: number, handle: DiscHandle | null) => void;
  onActivate?: (index: number) => void;
}

export default function Disc({
  index,
  current,
  n,
  labelMap,
  grooves,
  playing,
  register,
  onActivate,
}: DiscProps) {
  const root = useRef<THREE.Group>(null!);
  const spinner = useRef<THREE.Group>(null!);
  const hoverGrp = useRef<THREE.Group>(null!);
  const speed = useRef(0);
  const [hovered, setHovered] = useState(false);

  // Mount placement only — after this, the choreography owns `root`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => SLOTS[slotFor(index, current, n)], []);

  useEffect(() => {
    register(index, { root: root.current, spinner: spinner.current });
    return () => register(index, null);
  }, [index, register]);

  const slot = slotFor(index, current, n);
  const interactive = slot === "left" || slot === "right";

  useEffect(() => {
    document.body.style.cursor = hovered && interactive ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, interactive]);

  // Hover bump lives on its own group so it never fights the timeline.
  useEffect(() => {
    const s = hovered && interactive ? 1.06 : 1;
    gsap.to(hoverGrp.current.scale, {
      x: s,
      y: s,
      z: s,
      duration: 0.25,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, [hovered, interactive]);

  useFrame((_, dt) => {
    // Motor with inertia — grabs, winds up, winds down.
    const target = playing && slot === "center" ? SPIN_SPEED : 0;
    speed.current = THREE.MathUtils.damp(speed.current, target, 2.4, dt);
    spinner.current.rotation.y += speed.current * dt;
  });

  return (
    <group
      ref={root}
      position={initial.pos}
      rotation={[0, initial.rotY, 0]}
      scale={initial.scale}
    >
      <group ref={hoverGrp}>
        {/* tilt the cylinder so its face looks at the camera */}
        <group
          rotation={[Math.PI / 2, 0, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            if (interactive) onActivate?.(index);
          }}
        >
          <group ref={spinner}>
            {/* vinyl body — dark, lacquered, catches the blue key light */}
            <mesh>
              <cylinderGeometry args={[DISC_R, DISC_R, 0.05, 96]} />
              <meshPhysicalMaterial
                color="#141414"
                roughness={0.35}
                metalness={0.05}
                clearcoat={1}
                clearcoatRoughness={0.25}
                bumpMap={grooves}
                bumpScale={0.02}
              />
            </mesh>
            {/* label */}
            <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[DISC_R * 0.37, 48]} />
              <meshStandardMaterial map={labelMap} roughness={0.85} />
            </mesh>
            {/* off-center marker dot — rotation reads at a glance */}
            <mesh
              position={[DISC_R * 0.72, 0.027, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[0.055, 20]} />
              <meshStandardMaterial color="#7df08a" roughness={0.5} />
            </mesh>
            {/* spindle hole */}
            <mesh position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.05, 24]} />
              <meshStandardMaterial color="#f7f6f3" roughness={0.7} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w apps/web
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/studio/deck/Disc.tsx
git commit -m "feat(deck): carousel Disc — registry handle, motor inertia, hover bump"
```

---

### Task 5: Tonearm component

GSAP-driven only — no `useFrame` self-animation, so the timeline is the single owner of arm motion. Exports the three named poses the choreography tweens between.

**Files:**
- Create: `apps/web/components/studio/deck/Tonearm.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/components/studio/deck/Tonearm.tsx
"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";

export interface TonearmHandle {
  pivot: THREE.Group;
}

/** Named poses — the choreography tweens pivot.rotation.z / position.z. */
export const ARM_POSES = {
  down: { rotZ: -0.52, posZ: 0.28 }, // needle in the groove
  up: { rotZ: -0.3, posZ: 0.85 }, // lifted, still over the disc
  out: { rotZ: -0.05, posZ: 1.15 }, // swung away — "not playing this one"
} as const;

export type ArmPose = keyof typeof ARM_POSES;

interface TonearmProps {
  register: (handle: TonearmHandle | null) => void;
  startPose?: ArmPose;
}

export default function Tonearm({ register, startPose = "out" }: TonearmProps) {
  const pivot = useRef<THREE.Group>(null!);

  useEffect(() => {
    register({ pivot: pivot.current });
    return () => register(null);
  }, [register]);

  const p = ARM_POSES[startPose];

  return (
    // pivot sits off the top-right corner, like the sketch
    <group ref={pivot} position={[2.7, 2.9, p.posZ]} rotation={[0, 0, p.rotZ]}>
      {/* the stick */}
      <mesh position={[0, -1.7, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 3.6, 16]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* the head */}
      <group position={[0, -3.5, 0]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.3, 0.3, 0.16]} />
          <meshStandardMaterial color="#191919" roughness={0.4} />
        </mesh>
        {/* needle — brand blue, emissive so bloom catches it */}
        <mesh position={[0, -0.16, -0.05]}>
          <coneGeometry args={[0.03, 0.14, 12]} />
          <meshStandardMaterial
            color="#1450f0"
            emissive="#1450f0"
            emissiveIntensity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* status LED — green accent, used sparingly per spec */}
        <mesh position={[0.16, 0.1, 0.09]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial
            color="#7df08a"
            emissive="#7df08a"
            emissiveIntensity={2.2}
          />
        </mesh>
      </group>
    </group>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w apps/web
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/studio/deck/Tonearm.tsx
git commit -m "feat(deck): GSAP-driven Tonearm with named poses and emissive accents"
```

---

### Task 6: Retro post-processing stack

**Files:**
- Create: `apps/web/components/studio/deck/Effects.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/components/studio/deck/Effects.tsx
"use client";

import { Vector2 } from "three";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Glitch,
  Noise,
  Scanline,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, GlitchMode } from "postprocessing";

const ABERRATION_OFFSET = new Vector2(0.0012, 0.0008);
const GLITCH_DELAY = new Vector2(0.05, 0.25);
const GLITCH_DURATION = new Vector2(0.08, 0.22);
const GLITCH_STRENGTH = new Vector2(0.12, 0.4);

/**
 * 80s anime retrotech grade: grain, edge-weighted chromatic aberration,
 * faint scanlines, vignette, low bloom for the LEDs and blue highlights,
 * and a VHS tracking-error glitch that fires only during swaps.
 */
export default function DeckEffects({ glitch }: { glitch: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.4}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={ABERRATION_OFFSET}
        radialModulation
        modulationOffset={0.35}
      />
      <Scanline blendFunction={BlendFunction.OVERLAY} density={1.3} opacity={0.07} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.4} />
      <Vignette eskil={false} offset={0.22} darkness={0.78} />
      <Glitch
        active={glitch}
        mode={GlitchMode.SPORADIC}
        delay={GLITCH_DELAY}
        duration={GLITCH_DURATION}
        strength={GLITCH_STRENGTH}
        ratio={0.55}
      />
    </EffectComposer>
  );
}
```

Note: `Vector2` props are module constants, not inline literals — inline `new Vector2` per render would defeat prop memoization.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w apps/web
```

Expected: exit 0. If `radialModulation`/`modulationOffset` are rejected by the installed `postprocessing` version, drop those two props and keep the plain offset — do not upgrade the package.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/studio/deck/Effects.tsx
git commit -m "feat(deck): retro post stack — grain, aberration, scanlines, swap glitch"
```

---

### Task 7: Scene — canvas, lights, fog, parallax rig, platter

**Files:**
- Create: `apps/web/components/studio/deck/CarouselDeckScene.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/components/studio/deck/CarouselDeckScene.tsx
"use client";

import * as THREE from "three";
import React, { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

import type { DeckTrack } from "@/components/studio/DiscDeck";
import Disc, { DISC_R, useGrooveTexture, type DiscHandle } from "./Disc";
import Tonearm, { type TonearmHandle } from "./Tonearm";
import DeckEffects from "./Effects";

/* ── parallax rig: the diorama leans a few degrees toward the cursor ── */
function ParallaxRig({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((state, dt) => {
    g.current.rotation.y = THREE.MathUtils.damp(
      g.current.rotation.y,
      state.pointer.x * 0.09,
      4,
      dt
    );
    g.current.rotation.x = THREE.MathUtils.damp(
      g.current.rotation.x,
      -state.pointer.y * 0.05,
      4,
      dt
    );
  });
  return <group ref={g}>{children}</group>;
}

/* ── the platter the center disc sits on ── */
function Platter() {
  return (
    <group position={[0, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[DISC_R * 1.16, DISC_R * 1.16, 0.08, 96]} />
        <meshStandardMaterial color="#232323" metalness={0.85} roughness={0.35} />
      </mesh>
      {/* spindle pin */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.3, 16]} />
        <meshStandardMaterial color="#d7d5cf" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

interface DeckProps {
  tracks: DeckTrack[];
  current: number;
  playing: boolean;
  registerDisc: (index: number, handle: DiscHandle | null) => void;
  registerArm: (handle: TonearmHandle | null) => void;
  onSideClick: (index: number) => void;
}

function Deck({
  tracks,
  current,
  playing,
  registerDisc,
  registerArm,
  onSideClick,
}: DeckProps) {
  const grooves = useGrooveTexture();
  const urls = tracks.map(
    (t) => t.artUrl ?? `/textures/${t.texture ?? "tx-k2-vinyl"}.png`
  );
  const maps = useTexture(urls) as THREE.Texture[];
  maps.forEach((m) => {
    m.colorSpace = THREE.SRGBColorSpace;
    m.anisotropy = 8;
  });
  const n = tracks.length;

  return (
    <>
      <Platter />
      {tracks.map((t, i) => (
        <Disc
          key={i}
          index={i}
          current={current}
          n={n}
          labelMap={maps[i]}
          grooves={grooves}
          playing={playing}
          register={registerDisc}
          onActivate={onSideClick}
        />
      ))}
      <Tonearm register={registerArm} />
      {/* power LED on the stage floor, bottom-right of the platter */}
      <mesh position={[1.45, -1.35, 0.15]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial
          color="#7df08a"
          emissive="#7df08a"
          emissiveIntensity={playing ? 2.5 : 0.4}
        />
      </mesh>
    </>
  );
}

export interface CarouselDeckSceneProps extends DeckProps {
  glitch: boolean;
}

/** Detects WebGL availability so a blocked GPU shows a message, not a void. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function CarouselDeckScene({
  glitch,
  ...deck
}: CarouselDeckSceneProps) {
  const [glOk] = React.useState(webglAvailable);

  if (!glOk) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-ink rounded-lg">
        <span className="type-label text-destructive">
          WEBGL UNAVAILABLE — THE DECK NEEDS A GPU
        </span>
      </div>
    );
  }

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ position: [0, 0, 7.4], fov: 36 }}
      style={{ width: "100%", height: "100%" }}
      className="!touch-none"
    >
      <color attach="background" args={["#101010"]} />
      <fog attach="fog" args={["#101010", 9, 15.5]} />

      {/* 80s retrotech grade: blue key, cool rim, dim neutral fill */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[4.5, 5.5, 4]} intensity={2.6} color="#2e5cf2" />
      <directionalLight position={[-5, 2, -4]} intensity={1.6} color="#9db4ff" />
      <directionalLight position={[0, 0.5, 8]} intensity={0.55} color="#f7f6f3" />

      <Suspense fallback={null}>
        <ParallaxRig>
          <Deck {...deck} />
        </ParallaxRig>
      </Suspense>

      <DeckEffects glitch={glitch} />
    </Canvas>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w apps/web
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/studio/deck/CarouselDeckScene.tsx
git commit -m "feat(deck): carousel scene — blue-key lighting, fog, parallax rig, platter"
```

---

### Task 8: Choreography hook — the GSAP master timeline

Single owner of all slot/arm motion. Mash-proof: a running swap is jumped to its end state before the next one starts. Headless-safe: with no registered handles (tests, fallback) it only updates state.

**Files:**
- Create: `apps/web/components/studio/deck/useDeckChoreography.ts`

- [ ] **Step 1: Write the hook**

```ts
// apps/web/components/studio/deck/useDeckChoreography.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import gsap from "gsap";

import { SLOTS, slotFor } from "./slots";
import { nextIndex, seatRotation, type SwapDirection } from "./choreography-math";
import type { DiscHandle } from "./Disc";
import { ARM_POSES, type TonearmHandle } from "./Tonearm";

export type DeckPhase = "standby" | "playing" | "swapping";

interface Options {
  n: number;
  currentRef: React.MutableRefObject<number>;
  setCurrent: (i: number) => void;
  setPhase: (p: DeckPhase) => void;
  setGlitch: (on: boolean) => void;
  discs: React.MutableRefObject<Map<number, DiscHandle>>;
  tonearm: React.MutableRefObject<TonearmHandle | null>;
}

export function useDeckChoreography({
  n,
  currentRef,
  setCurrent,
  setPhase,
  setGlitch,
  discs,
  tonearm,
}: Options) {
  const tl = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    return () => {
      tl.current?.kill();
      tl.current = null;
    };
  }, []);

  /** Arm-only move for play/pause outside a swap. */
  const setArm = useCallback(
    (down: boolean) => {
      const arm = tonearm.current?.pivot;
      if (!arm) return;
      const pose = down ? ARM_POSES.down : ARM_POSES.out;
      gsap.to(arm.rotation, {
        z: pose.rotZ,
        duration: 0.5,
        ease: down ? "power3.in" : "power2.out",
        overwrite: "auto",
      });
      gsap.to(arm.position, {
        z: pose.posZ,
        duration: 0.5,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    },
    [tonearm]
  );

  const swap = useCallback(
    (dir: SwapDirection) => {
      if (n < 2) return;

      // Mash-proof: jump the running swap to its end state, start fresh.
      if (tl.current) {
        tl.current.progress(1).kill();
        tl.current = null;
      }

      const from = currentRef.current;
      const to = nextIndex(from, dir, n);
      currentRef.current = to;
      setCurrent(to);

      const arm = tonearm.current?.pivot;
      const out = discs.current.get(from);
      const inc = discs.current.get(to);
      if (!arm || !out || !inc) {
        // Headless (tests / WebGL fallback): state only, no motion.
        setPhase("playing");
        return;
      }

      setPhase("swapping");
      setGlitch(true);

      const outSlot = SLOTS[dir === "next" ? "left" : "right"];
      const t = gsap.timeline({
        defaults: { overwrite: "auto" },
        onComplete: () => {
          setGlitch(false);
          setPhase("playing"); // motor spin-up happens in Disc's useFrame
          tl.current = null;
        },
      });

      /* 1 ── tonearm lifts, swings out: "done with this one" */
      t.to(arm.position, { z: ARM_POSES.up.posZ, duration: 0.22, ease: "power2.out" }, 0);
      t.to(arm.rotation, { z: ARM_POSES.out.rotZ, duration: 0.42, ease: "power2.inOut" }, 0.08);
      t.to(arm.position, { z: ARM_POSES.out.posZ, duration: 0.3, ease: "power2.inOut" }, 0.14);

      /* 2 ── outgoing disc gets picked up: rises + grows slightly */
      t.to(out.root.position, { y: 0.55, duration: 0.32, ease: "power2.out" }, 0.28);
      t.to(out.root.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.32, ease: "power2.out" }, 0.28);

      /* 3 ── travel: outgoing arcs to its side slot… */
      t.to(out.root.position, { x: outSlot.pos[0], z: outSlot.pos[2], duration: 0.6, ease: "power2.inOut" }, 0.62);
      t.to(out.root.position, { y: outSlot.pos[1] + 0.4, duration: 0.3, ease: "power1.out" }, 0.62);
      t.to(out.root.position, { y: outSlot.pos[1], duration: 0.34, ease: "power1.in" }, 0.92);
      t.to(out.root.rotation, { y: outSlot.rotY, duration: 0.6, ease: "power2.inOut" }, 0.62);
      t.to(out.root.scale, { x: outSlot.scale, y: outSlot.scale, z: outSlot.scale, duration: 0.6, ease: "power2.inOut" }, 0.62);

      /* …incoming slides to a hover above the spindle, turning to face us,
         one settling revolution like a record being aimed at the pin */
      t.to(inc.root.position, { x: 0, z: 0, duration: 0.6, ease: "power2.inOut" }, 0.56);
      t.to(inc.root.position, { y: 0.5, duration: 0.45, ease: "power2.out" }, 0.56);
      t.to(inc.root.rotation, { y: 0, duration: 0.58, ease: "power2.inOut" }, 0.56);
      t.to(inc.root.scale, { x: 1.09, y: 1.09, z: 1.09, duration: 0.58, ease: "power2.inOut" }, 0.56);
      t.to(inc.spinner.rotation, { y: seatRotation(inc.spinner.rotation.y), duration: 0.85, ease: "power2.out" }, 0.56);

      /* 4 ── the put-down: settles onto the platter, soft landing */
      t.to(inc.root.position, { y: 0, duration: 0.34, ease: "back.out(2.4)" }, 1.24);
      t.to(inc.root.scale, { x: 1, y: 1, z: 1, duration: 0.34, ease: "back.out(2)" }, 1.24);

      /* 5 ── everyone else re-slots quietly in the background */
      discs.current.forEach((h, i) => {
        if (i === from || i === to) return;
        const s = SLOTS[slotFor(i, to, n)];
        t.to(h.root.position, { x: s.pos[0], y: s.pos[1], z: s.pos[2], duration: 0.55, ease: "power2.inOut" }, 0.62);
        t.to(h.root.rotation, { y: s.rotY, duration: 0.55, ease: "power2.inOut" }, 0.62);
        t.to(h.root.scale, { x: s.scale, y: s.scale, z: s.scale, duration: 0.55, ease: "power2.inOut" }, 0.62);
      });

      /* 6 ── tonearm returns, needle drops */
      t.to(arm.rotation, { z: ARM_POSES.up.rotZ, duration: 0.36, ease: "power2.inOut" }, 1.62);
      t.to(arm.position, { z: ARM_POSES.up.posZ, duration: 0.3, ease: "power2.inOut" }, 1.62);
      t.to(arm.rotation, { z: ARM_POSES.down.rotZ, duration: 0.24, ease: "power3.in" }, 2.0);
      t.to(arm.position, { z: ARM_POSES.down.posZ, duration: 0.24, ease: "power3.in" }, 2.0);

      tl.current = t;
    },
    [n, currentRef, setCurrent, setPhase, setGlitch, discs, tonearm]
  );

  return { swap, setArm };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w apps/web
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/studio/deck/useDeckChoreography.ts
git commit -m "feat(deck): GSAP master timeline — realistic pick-up/put-down swap"
```

---

### Task 9: CarouselDeck wrapper + /deck-lab page (TDD smoke test)

**Files:**
- Create: `apps/web/components/studio/deck/CarouselDeck.tsx`
- Create: `apps/web/app/deck-lab/page.tsx`
- Test: `apps/web/app/deck-lab/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/app/deck-lab/page.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The WebGL scene cannot run in jsdom — stub it out.
vi.mock("@/components/studio/deck/CarouselDeckScene", () => ({
  default: () => <div data-testid="scene" />,
}));

import DeckLabPage from "./page";

describe("deck-lab page", () => {
  it("renders the first mock track", () => {
    render(<DeckLabPage />);
    expect(screen.getByText("A.D. Police Opening")).toBeInTheDocument();
    expect(screen.getByText("KISIDAKYOUDAN")).toBeInTheDocument();
  });

  it("advances to the next track on next", () => {
    render(<DeckLabPage />);
    fireEvent.click(screen.getByLabelText("Next track"));
    expect(screen.getByText("Night Cruise '86")).toBeInTheDocument();
  });

  it("goes to the last track on previous (wrap-around)", () => {
    render(<DeckLabPage />);
    fireEvent.click(screen.getByLabelText("Previous track"));
    expect(screen.getByText("Last Train Home")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/web -- deck-lab
```

Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write the wrapper component**

```tsx
// apps/web/components/studio/deck/CarouselDeck.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { PlayerButton } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";
import type { DeckTrack } from "@/components/studio/DiscDeck";
import { slotFor } from "./slots";
import { useDeckChoreography, type DeckPhase } from "./useDeckChoreography";
import type { DiscHandle } from "./Disc";
import type { TonearmHandle } from "./Tonearm";

// The WebGL scene is client-only — no SSR.
const CarouselDeckScene = dynamic(() => import("./CarouselDeckScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <span className="type-label text-muted-foreground">
        WARMING UP THE DECK…
      </span>
    </div>
  ),
});

interface CarouselDeckProps {
  tracks: DeckTrack[];
  className?: string;
}

/**
 * Cinematic 3D turntable carousel. All slot/arm motion is owned by the
 * GSAP choreography hook; this wrapper owns React state and the DOM
 * overlay (title, controls, status line).
 */
export default function CarouselDeck({ tracks, className }: CarouselDeckProps) {
  const n = tracks.length;
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<DeckPhase>("standby");
  const [glitch, setGlitch] = useState(false);
  const currentRef = useRef(0);

  const discs = useRef(new Map<number, DiscHandle>());
  const tonearm = useRef<TonearmHandle | null>(null);
  const registerDisc = useCallback((i: number, h: DiscHandle | null) => {
    if (h) discs.current.set(i, h);
    else discs.current.delete(i);
  }, []);
  const registerArm = useCallback((h: TonearmHandle | null) => {
    tonearm.current = h;
  }, []);

  const { swap, setArm } = useDeckChoreography({
    n,
    currentRef,
    setCurrent,
    setPhase,
    setGlitch,
    discs,
    tonearm,
  });

  const busy = phase === "swapping";
  const playing = phase === "playing";

  const toggle = () => {
    if (busy) return;
    if (playing) {
      setPhase("standby");
      setArm(false);
    } else {
      setPhase("playing");
      setArm(true);
    }
  };

  const onSideClick = (idx: number) => {
    const s = slotFor(idx, currentRef.current, n);
    if (s === "right") swap("next");
    else if (s === "left") swap("prev");
  };

  const track = tracks[current];

  return (
    <div className={cn("w-full flex flex-col items-center gap-4", className)}>
      {/* ── the deck (WebGL) ── */}
      <div className="relative w-full max-w-3xl h-[460px] rounded-lg overflow-hidden">
        <CarouselDeckScene
          tracks={tracks}
          current={current}
          playing={playing}
          glitch={glitch}
          registerDisc={registerDisc}
          registerArm={registerArm}
          onSideClick={onSideClick}
        />
      </div>

      {/* ── now playing ── */}
      <div className="text-center min-h-[52px]">
        <div className={cn("type-h4", busy && "opacity-60")}>{track.title}</div>
        <div className="type-label text-muted-foreground mt-0.5">
          {track.artist}
        </div>
      </div>

      {/* ── controls — next/prev stay live during a swap (mash-proof) ── */}
      <div className="flex items-center gap-3">
        <PlayerButton onClick={() => swap("prev")} aria-label="Previous track">
          <TrackPreviousIcon />
        </PlayerButton>
        <PlayerButton
          variant="primary"
          size="lg"
          loading={busy}
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          <IconSwap
            active={playing ? "pause" : "play"}
            icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
          />
        </PlayerButton>
        <PlayerButton onClick={() => swap("next")} aria-label="Next track">
          <TrackNextIcon />
        </PlayerButton>
      </div>

      {/* machine status line */}
      <div className="type-label text-muted-foreground">
        {busy ? "SWAPPING DISC…" : playing ? "NOW SPINNING" : "ON STANDBY"}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

```tsx
// apps/web/app/deck-lab/page.tsx
"use client";

import CarouselDeck from "@/components/studio/deck/CarouselDeck";
import type { DeckTrack } from "@/components/studio/DiscDeck";

const TRACKS: DeckTrack[] = [
  { title: "A.D. Police Opening", artist: "KISIDAKYOUDAN", artUrl: "/textures/tx-k2-vinyl.png" },
  { title: "Night Cruise '86", artist: "Studio Yuki", artUrl: "/textures/tx-k-marble.png" },
  { title: "Neon Rain", artist: "Analog Ghost", artUrl: "/textures/tx-k2-checker.png" },
  { title: "Terminal Dream", artist: "Metro Circuit", artUrl: "/textures/tx-k-silk.png" },
  { title: "Last Train Home", artist: "Kissaten Club", artUrl: "/textures/tx-k2-horizon.png" },
];

export default function DeckLabPage() {
  return (
    <main className="min-h-screen w-full bg-[#101010] text-[#f7f6f3] flex items-center justify-center p-6">
      <CarouselDeck tracks={TRACKS} className="max-w-3xl" />
    </main>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -w apps/web -- deck-lab
```

Expected: PASS (3 tests). The mocked scene means `swap` runs headless — state updates immediately, no timeline.

- [ ] **Step 6: Full test suite + typecheck**

```bash
npm run test -w apps/web
npm run typecheck -w apps/web
```

Expected: all suites pass, typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/studio/deck/CarouselDeck.tsx apps/web/app/deck-lab/page.tsx apps/web/app/deck-lab/page.test.tsx
git commit -m "feat(deck): /deck-lab preview page with carousel deck and overlay"
```

---

### Task 10: Browser verification and tuning

**Files:**
- Modify (if tuning needed): any of the `components/studio/deck/*` files

- [ ] **Step 1: Start the dev server and open the page**

Use the preview tools (never Bash) — start the `apps/web` dev server from `.claude/launch.json` (add an entry if missing: `runtimeExecutable: "npm"`, `runtimeArgs: ["run", "dev", "-w", "apps/web"]`, port 3000) and navigate to `http://localhost:3000/deck-lab`.

- [ ] **Step 2: Verify the idle state**

- Screenshot: dark stage, blue-tinted key light on the vinyl, three discs (center + two tilted sides), tonearm parked out, grain/scanlines/vignette visible.
- Console: no WebGL or React errors.

- [ ] **Step 3: Verify the choreography**

- Click Play → arm drops, center disc spins up with inertia, LED brightens, status reads NOW SPINNING.
- Click Next → full sequence: arm lifts/swings out → playing disc rises and grows → arcs left while the incoming disc slides in, turns to face, hovers, seats with a bounce → arm returns, needle drops → spin-up. Glitch bursts during the swap. Screenshot mid-swap.
- Click Next rapidly 5× → no stuck state; each press fast-forwards and restarts; ends on a coherent slot layout.
- Click Previous → mirrored sequence, wraps from track 1 to track 5.
- Hover a side disc → cursor pointer + scale bump; click it → correct-direction swap.
- Move the mouse around → the diorama leans a few degrees (parallax).

- [ ] **Step 4: Performance sanity**

In the browser console: `let f=0,s=performance.now();requestAnimationFrame(function r(){f++;performance.now()-s<3000?requestAnimationFrame(r):console.log("fps",(f/3).toFixed(1))})` — expect ~60 (or display refresh), including during a swap.

- [ ] **Step 5: Fix and tune**

Diagnose any visual/timing issue in source, re-check from Step 2. Typical dials: light intensities, `fog` near/far, effect opacities, timeline position labels (the `0.62`-style offsets), ease strings.

- [ ] **Step 6: Commit tuning**

```bash
git add -A apps/web/components/studio/deck
git commit -m "polish(deck): tune lighting, effects, and swap timing after browser pass"
```

---

## Task order

1 (deps) → 2 (slots) → 3 (math) → 4 (Disc) → 5 (Tonearm) → 6 (Effects) → 7 (Scene) → 8 (Choreography) → 9 (Wrapper + page) → 10 (Browser verify). Tasks 4–8 are typecheck-only until the page exists in Task 9; the browser pass in Task 10 is where visuals get validated.
