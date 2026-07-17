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
