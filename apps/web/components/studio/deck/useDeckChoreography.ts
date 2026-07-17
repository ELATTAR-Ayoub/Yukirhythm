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
