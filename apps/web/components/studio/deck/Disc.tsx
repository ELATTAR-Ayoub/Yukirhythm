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

/**
 * Procedural vinyl groove bump map (canvas-generated once).
 *
 * Building the canvas is a side effect on a DOM node plus a `Math.random`
 * call, so it cannot run during render (react-hooks/purity) — it runs in an
 * effect after mount instead, and the disc renders without its bump map for
 * the first frame or two. That's an acceptable trade for a decorative
 * groove texture on a 3D deck-lab surface.
 */
export function useGrooveTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
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
    setTexture(tex);
    return () => tex.dispose();
  }, []);

  return texture;
}

interface DiscProps {
  index: number;
  current: number;
  n: number;
  labelMap: THREE.Texture;
  /** Null until the groove bump map finishes building in an effect. */
  grooves: THREE.Texture | null;
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
                bumpMap={grooves ?? undefined}
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
