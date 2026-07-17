"use client";

import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, RoundedBox, useTexture } from "@react-three/drei";

import type { DeckTrack, DeckPhase } from "@/components/studio/DiscDeck";

/* ── constants ─────────────────────────────────────────────────── */
const DISC_R = 1.42;
const DISC_Y = 0.215; // resting height of a seated disc
const SPIN_SPEED = 2.6; // rad/s ≈ 33rpm feel, scaled for drama

type Slot = "center" | "left" | "right" | "hidden";

const SLOTS: Record<
  Slot,
  { pos: [number, number, number]; rot: [number, number, number]; scale: number }
> = {
  center: { pos: [0, DISC_Y, 0], rot: [0, 0, 0], scale: 1 },
  left: { pos: [-2.75, 1.1, -0.7], rot: [-0.95, 0.45, 0.12], scale: 0.78 },
  right: { pos: [2.75, 1.1, -0.7], rot: [-0.95, -0.45, -0.12], scale: 0.78 },
  hidden: { pos: [0, 0.9, -3.6], rot: [-0.95, 0, 0], scale: 0.12 },
};

/* ── procedural vinyl groove maps ──────────────────────────────── */
function useGrooveTexture() {
  return useMemo(() => {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2;
    // fine concentric grooves with subtle irregularity
    for (let r = size * 0.16; r < size * 0.5; r += 2.2) {
      const shade = 96 + Math.floor(Math.random() * 64);
      ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // a few deeper track-separator grooves
    for (let i = 0; i < 5; i++) {
      const r = size * (0.2 + 0.28 * Math.random());
      ctx.strokeStyle = "rgb(40,40,40)";
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

/* ── one vinyl record ──────────────────────────────────────────── */
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
  const root = useRef<THREE.Group>(null!); // slot position/tilt/scale
  const spinner = useRef<THREE.Group>(null!); // rotation about the spindle
  const speed = useRef(0);
  const scaleBoost = useRef(1);
  const wasInstalling = useRef(false);

  useEffect(() => {
    // the incoming disc: appears held above the platter, then seats
    if (installing && slot === "center" && !wasInstalling.current) {
      if (root.current) {
        root.current.position.y = DISC_Y + 1.7;
        root.current.position.z = -0.4;
        scaleBoost.current = 1.14;
      }
    }
    wasInstalling.current = installing && slot === "center";
  }, [installing, slot]);

  useFrame((_, dt) => {
    const t = SLOTS[slot];
    const g = root.current;
    if (!g) return;
    // damp toward slot targets — heavier lambda vertically = the "seat" drop
    g.position.x = THREE.MathUtils.damp(g.position.x, t.pos[0], 5.5, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, t.pos[1], 6.5, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, t.pos[2], 5.5, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, t.rot[0], 6, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, t.rot[1], 6, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, t.rot[2], 6, dt);
    scaleBoost.current = THREE.MathUtils.damp(scaleBoost.current, 1, 7, dt);
    const s = t.scale * scaleBoost.current;
    g.scale.setScalar(s);

    // platter inertia: spin up / spin down instead of on/off
    const target = spinning && slot === "center" ? SPIN_SPEED : 0;
    speed.current = THREE.MathUtils.damp(speed.current, target, 1.6, dt);
    spinner.current.rotation.y += speed.current * dt;
    // barely-warped vinyl
    spinner.current.rotation.x =
      Math.sin(spinner.current.rotation.y * 2) * 0.0045;
  });

  return (
    <group ref={root}>
      <group ref={spinner}>
        {/* the vinyl body */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[DISC_R, DISC_R, 0.035, 96]} />
          <meshPhysicalMaterial
            color="#131312"
            roughness={0.42}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.3}
            bumpMap={grooves}
            bumpScale={0.012}
          />
        </mesh>
        {/* label */}
        <mesh position={[0, 0.019, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[DISC_R * 0.36, 48]} />
          <meshStandardMaterial map={labelMap} roughness={0.85} />
        </mesh>
        <mesh
          position={[0, -0.019, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[DISC_R * 0.36, 48]} />
          <meshStandardMaterial color="#26251f" roughness={0.9} />
        </mesh>
        {/* spindle hole rim */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.035, 0.06, 24]} />
          <meshStandardMaterial color="#f7f6f3" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/* ── the tonearm ───────────────────────────────────────────────── */
function Tonearm({ down }: { down: boolean }) {
  const pivot = useRef<THREE.Group>(null!); // swing (y)
  const lift = useRef<THREE.Group>(null!); // head raise (z tilt)

  useFrame((_, dt) => {
    const targetSwing = down ? 0.98 : 0.35; // swings the head over the platter
    const targetLift = down ? 0 : 0.09;
    pivot.current.rotation.y = THREE.MathUtils.damp(
      pivot.current.rotation.y,
      targetSwing,
      3.2,
      dt
    );
    lift.current.rotation.z = THREE.MathUtils.damp(
      lift.current.rotation.z,
      targetLift,
      4,
      dt
    );
  });

  const metal = (
    <meshStandardMaterial color="#c9c8c2" metalness={0.9} roughness={0.28} />
  );

  return (
    <group position={[2.45, 0, -1.5]}>
      {/* base puck */}
      <mesh castShadow position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.32, 32]} />
        <meshStandardMaterial color="#1f1e1c" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* bearing post */}
      <mesh castShadow position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.35, 24]} />
        {metal}
      </mesh>
      {/* swinging assembly */}
      <group ref={pivot} position={[0, 0.62, 0]}>
        <group ref={lift}>
          {/* counterweight */}
          <mesh castShadow position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.22, 24]} />
            <meshStandardMaterial
              color="#2a2926"
              metalness={0.8}
              roughness={0.35}
            />
          </mesh>
          {/* arm tube */}
          <mesh castShadow position={[-1.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.042, 0.042, 2.75, 20]} />
            {metal}
          </mesh>
          {/* headshell */}
          <group position={[-2.72, -0.05, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.34, 0.09, 0.15]} />
              <meshStandardMaterial
                color="#191919"
                metalness={0.3}
                roughness={0.45}
              />
            </mesh>
            {/* cartridge + stylus */}
            <mesh position={[-0.06, -0.08, 0]}>
              <boxGeometry args={[0.14, 0.08, 0.11]} />
              <meshStandardMaterial color="#1450f0" roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ── deck body, platter, lights ────────────────────────────────── */
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
      {/* deck body */}
      <RoundedBox
        args={[7.6, 0.5, 4.7]}
        radius={0.12}
        position={[0, -0.26, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#202019" metalness={0.25} roughness={0.55} />
      </RoundedBox>
      {/* platter */}
      <mesh position={[0, 0.075, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.74, 1.78, 0.15, 72]} />
        <meshStandardMaterial color="#3a3934" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* platter edge accent */}
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.66, 1.73, 72]} />
        <meshStandardMaterial
          color="#1450f0"
          emissive="#1450f0"
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
      {/* slipmat */}
      <mesh position={[0, 0.155, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 64]} />
        <meshStandardMaterial color="#141413" roughness={0.95} />
      </mesh>
      {/* spindle */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.34, 16]} />
        <meshStandardMaterial color="#d8d7d2" metalness={0.9} roughness={0.25} />
      </mesh>

      {/* discs */}
      {tracks.map((t, i) => {
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

      <Tonearm down={phase === "playing"} />

      {/* lights */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[4, 7, 4]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 3.5, -2]} intensity={40} color="#1450f0" />
      <pointLight position={[3.5, 2.5, 4]} intensity={18} color="#fff6e6" />

      <ContactShadows
        position={[0, -0.52, 0]}
        opacity={0.5}
        scale={13}
        blur={2.6}
        far={3}
      />
    </>
  );
}

export interface DeckSceneProps {
  tracks: DeckTrack[];
  current: number;
  phase: DeckPhase;
  spinning: boolean;
}

export default function DeckScene(props: DeckSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 3.7, 6.6], fov: 38 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.35, 0)}
      className="!touch-none"
    >
      <Suspense fallback={null}>
        <Deck {...props} />
      </Suspense>
    </Canvas>
  );
}
