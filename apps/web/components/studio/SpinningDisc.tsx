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
/** Velocity below which a coasting platter is treated as stopped. */
const REST_EPSILON = 0.02;

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
  // Reassigned by the mount effect once the loop exists; calling it is the
  // only way anything outside the rAF callback can restart a parked loop.
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // matchMedia is missing under jsdom, so guard rather than assume it.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = "rotate(0deg)";
      return;
    }

    // Mutable integration state lives in a ref, not component state, so a
    // frame never triggers a re-render. `raf === 0` doubles as "parked" —
    // it is the single source of truth both the tick loop and `wake` check.
    const state = { angle: 0, velocity: 0, last: performance.now(), raf: 0 };

    const tick = (now: number) => {
      const dt = Math.min((now - state.last) / 1000, 0.1); // clamp tab-switch jumps
      state.last = now;

      const target = spinningRef.current ? MAX_DPS : 0;
      const tau = target > state.velocity ? SPIN_UP_TAU : SPIN_DOWN_TAU;
      // exponential approach — frame-rate independent, unlike a fixed step
      state.velocity += (target - state.velocity) * (1 - Math.exp(-dt / tau));
      if (!spinningRef.current && state.velocity < REST_EPSILON) {
        state.velocity = 0;
      }

      state.angle = (state.angle + state.velocity * dt) % 360;
      el.style.transform = `rotate(${state.angle}deg)`;

      // Park once there is truly nothing left to animate: not commanded to
      // spin, and no residual velocity to bleed off. `spinning` alone is not
      // enough here — a disc mid-coast still has work to do this frame.
      if (!spinningRef.current && state.velocity === 0) {
        state.raf = 0;
        return;
      }
      state.raf = requestAnimationFrame(tick);
    };

    // The restart path: a `spinning` prop flip calls this. If the loop is
    // still running (raf !== 0), it's a no-op — the next tick already reads
    // the fresh spinningRef. If parked, it reseeds `last` (so the elapsed
    // dt isn't the entire parked duration) and reschedules from here, which
    // is the only place a new rAF can be requested once parked.
    wakeRef.current = () => {
      if (state.raf !== 0) return;
      state.last = performance.now();
      state.raf = requestAnimationFrame(tick);
    };

    state.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
      wakeRef.current = () => {};
    };
  }, []);

  // Fires on every `spinning` change, including the one on mount. Nothing
  // reads spinningRef until a later rAF callback (never synchronously
  // during render), so updating it here — instead of during render — is
  // safe and keeps ref writes out of the render phase. The wake() call is
  // what makes a parked loop resume the instant playback restarts, instead
  // of waiting on some unrelated re-render to notice.
  useEffect(() => {
    spinningRef.current = spinning;
    if (spinning) wakeRef.current();
  }, [spinning]);

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
