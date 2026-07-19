"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import Texture, { type TextureName } from "@/components/studio/Texture";

/** Full speed, degrees per second (~18s per revolution — a 33⅓ feel). */
const MAX_DPS = 20;
/** Seconds to close ~63% of the gap to the target speed. Spin-up is quicker
 *  than spin-down: a platter has a motor pushing it up, only drag slowing it. */
const SPIN_UP_TAU = 0.55;
const SPIN_DOWN_TAU = 1.15;

interface SpinningDiscProps {
  texture: TextureName;
  /** Artwork at the spindle; omit for a plain label. */
  labelTexture?: TextureName;
  spinning: boolean;
  className?: string;
  /** Spindle label size; the disc itself fills the box. */
  labelClassName?: string;
}

/**
 * A record that spools up and coasts down instead of snapping between still
 * and full speed. CSS `animation-play-state` gives an instant stop, which
 * reads as a video pause rather than a platter losing momentum — so the angle
 * is integrated per frame with a first-order approach to the target speed.
 */
export default function SpinningDisc({
  texture,
  labelTexture,
  spinning,
  className,
  labelClassName = "w-1/3 h-1/3",
}: SpinningDiscProps) {
  const ref = useRef<HTMLDivElement>(null);
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // matchMedia is missing under jsdom, so guard rather than assume it.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = "rotate(0deg)";
      return;
    }

    let angle = 0;
    let velocity = 0; // deg/sec
    let last = performance.now();
    let raf = 0;

    // Runs for as long as the disc is mounted. An earlier version parked the
    // loop once the platter stopped and restarted it from a timer, but that
    // state machine could leave the loop dormant; the work here is a few
    // floating-point ops per frame, so it isn't worth the moving parts.
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); // clamp tab-switch jumps
      last = now;

      const target = spinningRef.current ? MAX_DPS : 0;
      const tau = target > velocity ? SPIN_UP_TAU : SPIN_DOWN_TAU;
      // exponential approach — frame-rate independent, unlike a fixed step
      velocity += (target - velocity) * (1 - Math.exp(-dt / tau));
      if (!spinningRef.current && velocity < 0.02) velocity = 0;

      angle = (angle + velocity * dt) % 360;
      el.style.transform = `rotate(${angle}deg)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className={cn("relative block overflow-hidden rounded-full", className)}>
      <span ref={ref} className="absolute inset-0 block will-change-transform">
        <Texture name={texture} className="absolute inset-0 w-full h-full" />
        {labelTexture ? (
          <span
            className={cn(
              "absolute inset-0 m-auto block rounded-full overflow-hidden",
              labelClassName
            )}
          >
            <Texture name={labelTexture} className="w-full h-full" />
          </span>
        ) : null}
      </span>
    </span>
  );
}
