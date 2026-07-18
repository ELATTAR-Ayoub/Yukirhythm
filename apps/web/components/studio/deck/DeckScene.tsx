"use client";

import * as THREE from "three";
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

import type { DeckTrack, DeckPhase } from "@/components/studio/DiscDeck";

/* ── constants ─────────────────────────────────────────────────── */
const DISC_R = 1.5;
const SPIN_SPEED = 3.1; // rad/s

type Slot = "center" | "left" | "right" | "hidden";

// Frontal composition, straight from the owner's sketch:
// center disc faces the viewer, neighbours are ellipses tilted in 3D.
const SLOTS: Record<
  Slot,
  { pos: [number, number, number]; rotY: number; scale: number }
> = {
  center: { pos: [0, 0, 0], rotY: 0, scale: 1 },
  left: { pos: [-3.05, 0, -0.9], rotY: 1.05, scale: 0.86 },
  right: { pos: [3.05, 0, -0.9], rotY: -1.05, scale: 0.86 },
  hidden: { pos: [0, -0.6, -4.2], rotY: 0, scale: 0.15 },
};

/* ── procedural vinyl groove map ───────────────────────────────── */
function useGrooveTexture() {
  return useMemo(() => {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2;
    // Decorative procedural groove noise. Math.random is intentional here and
    // safe: the texture is built once inside useMemo([]) and never re-derived,
    // so react-hooks/purity's idempotency concern does not apply.
    /* eslint-disable react-hooks/purity */
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
    /* eslint-enable react-hooks/purity */
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

/* ── one vinyl record, facing the viewer ───────────────────────── */
function Disc({
  labelMap,
  slot,
  spinning,
  installing,
  grooves,
}: {
  labelMap: THREE.Texture;
  slot: Slot;
  spinning: boolean;
  installing: boolean;
  grooves: THREE.Texture;
}) {
  const root = useRef<THREE.Group>(null!); // slot position / tilt / scale
  const spinner = useRef<THREE.Group>(null!); // rotation about the face axis
  const speed = useRef(0);
  const vy = useRef(0); // vertical spring velocity — the seat bounce
  const wasInstalling = useRef(false);

  useEffect(() => {
    // incoming disc drops in from above the row, then settles — smooth
    if (installing && slot === "center" && !wasInstalling.current) {
      if (root.current) {
        root.current.position.y = 3.1;
        root.current.position.z = 0.7;
        vy.current = 0; // dropped, not thrown
      }
    }
    wasInstalling.current = installing && slot === "center";
  }, [installing, slot]);

  useFrame((_, dt) => {
    const t = SLOTS[slot];
    const g = root.current;
    if (!g) return;
    g.position.x = THREE.MathUtils.damp(g.position.x, t.pos[0], 7, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, t.pos[2], 7, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, t.rotY, 7, dt);
    const s = THREE.MathUtils.damp(g.scale.x, t.scale, 8, dt);
    g.scale.setScalar(s);

    // vertical = a real underdamped spring: the disc SEATS with a bounce
    const step = Math.min(dt, 1 / 30);
    const dy = g.position.y - t.pos[1];
    vy.current += (-90 * dy - 9 * vy.current) * step;
    g.position.y += vy.current * step;

    // spin with inertia — motor grabs, winds up, winds down
    const target = spinning && slot === "center" ? SPIN_SPEED : 0;
    speed.current = THREE.MathUtils.damp(speed.current, target, 2.4, dt);
    spinner.current.rotation.y += speed.current * dt;
  });

  return (
    <group ref={root}>
      {/* tilt the cylinder so its face looks at the camera */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={spinner}>
          {/* vinyl body */}
          <mesh>
            <cylinderGeometry args={[DISC_R, DISC_R, 0.05, 96]} />
            <meshPhysicalMaterial
              color="#1b1b1a"
              roughness={0.4}
              metalness={0.05}
              clearcoat={0.9}
              clearcoatRoughness={0.3}
              bumpMap={grooves}
              bumpScale={0.02}
            />
          </mesh>
          {/* label — on the face looking at the viewer */}
          <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[DISC_R * 0.37, 48]} />
            <meshStandardMaterial map={labelMap} roughness={0.85} />
          </mesh>
          {/* off-center marker dot — rotation is readable even at a glance */}
          <mesh position={[DISC_R * 0.72, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
  );
}

/* ── the stick finger — a stylus arm from the top-right ────────── */
function StickFinger({ down }: { down: boolean }) {
  const pivot = useRef<THREE.Group>(null!);

  useFrame((_, dt) => {
    const g = pivot.current;
    // down: tip rests on the disc face · rest: swung up-right, lifted off
    const targetZrot = down ? -0.52 : -0.12;
    const targetZ = down ? 0.28 : 1.1;
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, targetZrot, 5.5, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, targetZ, 5.5, dt);
  });

  return (
    // pivot sits off the top-right corner, like the sketch
    <group ref={pivot} position={[2.7, 2.9, 0.6]}>
      {/* the stick */}
      <mesh position={[0, -1.7, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 3.6, 16]} />
        <meshStandardMaterial color="#191919" metalness={0.55} roughness={0.35} />
      </mesh>
      {/* the finger (head) */}
      <group position={[0, -3.5, 0]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.3, 0.3, 0.16]} />
          <meshStandardMaterial color="#191919" roughness={0.4} />
        </mesh>
        {/* needle tip */}
        <mesh position={[0, -0.16, -0.05]}>
          <coneGeometry args={[0.03, 0.14, 12]} />
          <meshStandardMaterial color="#1450f0" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/* ── the trio + light ──────────────────────────────────────────── */
function Deck({
  tracks,
  current,
  phase,
  spinning,
}: {
  tracks: DeckTrack[];
  current: number;
  phase: DeckPhase;
  spinning: boolean;
}) {
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
      {tracks.map((_t, i) => {
        const o = (((i - current) % n) + n) % n;
        const slot: Slot =
          o === 0 ? "center" : o === 1 ? "right" : o === n - 1 ? "left" : "hidden";
        return (
          <Disc
            key={i}
            labelMap={maps[i]}
            slot={slot}
            spinning={spinning}
            installing={phase === "installing"}
            grooves={grooves}
          />
        );
      })}

      <StickFinger down={phase === "playing"} />

      {/* bright neutral studio light — the page itself is the stage */}
      <ambientLight intensity={1.15} />
      <directionalLight position={[4, 6, 5]} intensity={2.1} />
      <directionalLight position={[0, 1, 8]} intensity={0.9} />
      <directionalLight position={[-5, -2, 3]} intensity={0.45} />
    </>
  );
}

export interface DeckSceneProps {
  tracks: DeckTrack[];
  current: number;
  phase: DeckPhase;
  spinning: boolean;
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

export default function DeckScene(props: DeckSceneProps) {
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
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      camera={{ position: [0, 0, 7.4], fov: 36 }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0, 0);
        console.info(
          "[DeckScene] renderer ready",
          gl.domElement.width,
          "x",
          gl.domElement.height
        );
      }}
      className="!touch-none"
    >
      <Suspense fallback={null}>
        <Deck {...props} />
      </Suspense>
    </Canvas>
  );
}
