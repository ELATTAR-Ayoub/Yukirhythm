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
