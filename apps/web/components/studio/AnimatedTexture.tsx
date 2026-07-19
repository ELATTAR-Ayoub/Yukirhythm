"use client";

import { useEffect, useRef } from "react";

/**
 * Live dithered branding textures — the animated counterpart to <Texture>,
 * ported from the owner's yuki-texture pack (yuki-texture.js) into React.
 *
 * Renders a small 110×110 buffer, quantises it through an 8×8 Bayer matrix
 * onto the six-stop Studio ramp, then scales up with pixelated rendering — so
 * the chunky dither is the point, not an artifact. Deliberately stepped at
 * ~20fps to match the branding's mechanical feel.
 */

export const ANIMATED_TEXTURE_KINDS = [
  "marble",
  "ripple",
  "vinyl",
  "bars",
  "static",
  "checker",
  "plasma",
  "tunnel",
  "spiral",
  "lava",
  "scanline",
  "moire",
] as const;

export type AnimatedTextureKind = (typeof ANIMATED_TEXTURE_KINDS)[number];

/** 8×8 Bayer matrix — the dither threshold map. */
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/** Studio palette ramp, dark → light. */
const RAMP = [
  [25, 25, 25],
  [16, 50, 150],
  [20, 80, 240],
  [90, 160, 250],
  [125, 240, 138],
  [247, 246, 243],
];

/** Shared fBm-ish warp used by most kinds. */
function marbleAt(x: number, y: number, t: number, warp = 3): number {
  let v = 0;
  let a = 1;
  let f = 0.013;
  for (let o = 0; o < 4; o++) {
    v += a * Math.sin(x * f + warp * Math.sin(y * f * 1.7 + o * 2.1 + t * 0.6) + o * 5 + t * 0.4);
    a *= 0.55;
    f *= 2.1;
  }
  return v;
}

type FieldFn = (x: number, y: number, t: number, S: number) => number;

const FIELDS: Record<AnimatedTextureKind, FieldFn> = {
  marble: (x, y, t) => (marbleAt(x * 1.6, y * 1.6, t) + 2) / 4,
  ripple: (x, y, t, S) => {
    const dx = x - S / 2;
    const dy = y - S / 2;
    const r = Math.sqrt(dx * dx + dy * dy);
    return Math.sin(r * 0.14 - t * 2.2 + marbleAt(x, y, t * 0.3) * 1.2) * 0.5 + 0.5;
  },
  vinyl: (x, y, t, S) => {
    const dx = x - S / 2;
    const dy = y - S / 2;
    const r = Math.sqrt(dx * dx + dy * dy);
    const a = Math.atan2(dy, dx);
    return (
      (Math.sin(r * 0.55 - t * 1.5) * 0.5 + 0.5) * 0.35 +
      (Math.sin(r * 0.06 + Math.sin(a * 3 + t) * 0.5 + marbleAt(x, y, 0) * 0.4) * 0.5 + 0.5) * 0.65
    );
  },
  bars: (x, y, t, S) => {
    const col = Math.floor(x / (S / 22));
    const hgt =
      (Math.sin(col * 2.7 + t * 1.8) * 0.5 + 0.5) * 0.6 + 0.18 + Math.sin(col * 13.7 + t * 3.1) * 0.12;
    return (S - y) / S < hgt ? 0.65 + marbleAt(x * 4, y * 4, t * 0.5) * 0.15 : 0.08;
  },
  static: (x, y, t) => {
    const row = Math.sin(y * 0.7 + t * 8) * 0.5 + 0.5;
    let v = Math.random() * 0.55 * row + ((marbleAt(x * 3, y * 0.5, t) + 2) / 4) * 0.45;
    if (Math.random() < 0.01) v = 1;
    return v;
  },
  checker: (x, y, t, S) => {
    const ch = (Math.floor(x / (S / 20)) + Math.floor(y / (S / 20))) % 2;
    const g = ((x + y) / (2 * S) + t * 0.15) % 1;
    return ch * (1 - g) * 0.9 + g * ((marbleAt(x * 2, y * 2, t) + 2) / 4);
  },
  plasma: (x, y, t, S) => {
    const v =
      Math.sin(x * 0.09 + t) +
      Math.sin(y * 0.11 - t * 0.8) +
      Math.sin((x + y) * 0.06 + t * 1.3) +
      Math.sin(Math.sqrt((x - S / 2) ** 2 + (y - S / 2) ** 2) * 0.12 - t * 1.6);
    return v / 8 + 0.5;
  },
  tunnel: (x, y, t, S) => {
    const dx = x - S / 2;
    const dy = y - S / 2;
    const r = Math.sqrt(dx * dx + dy * dy) + 0.6;
    const a = Math.atan2(dy, dx);
    return Math.sin(28 / r - t * 3 + a * 3) * 0.5 + 0.5;
  },
  spiral: (x, y, t, S) => {
    const dx = x - S / 2;
    const dy = y - S / 2;
    const r = Math.sqrt(dx * dx + dy * dy);
    const a = Math.atan2(dy, dx);
    return Math.sin(a * 4 + r * 0.18 - t * 2.4) * 0.5 + 0.5;
  },
  lava: (x, y, t) => (marbleAt(x * 2.4 + t * 14, y * 2.4 - t * 9, t * 0.8, 4.5) + 2) / 4,
  scanline: (x, y, t, S) => {
    const wave = Math.sin(x * 0.06 + marbleAt(x, y, t * 0.4) * 1.4 + t * 1.2) * 0.5 + 0.5;
    const sweep = Math.max(0, 1 - Math.abs((y / S - ((t * 0.35) % 1.3)) * 6));
    return Math.min(1, wave * 0.65 + sweep * 0.5);
  },
  moire: (x, y, t) => {
    const a = Math.sin(x * 0.32 + Math.sin(t * 0.7) * 2) * Math.sin(y * 0.32 + Math.cos(t * 0.9) * 2);
    const b = Math.sin((x * Math.cos(t * 0.3) - y * Math.sin(t * 0.3)) * 0.28);
    return (a + b) / 4 + 0.5;
  },
};

const SIZE = 110;
const FRAME_MS = 50; // ~20fps, deliberate stepped feel

interface AnimatedTextureProps {
  kind?: AnimatedTextureKind;
  /** Time multiplier — below 1 is calmer, above 1 more frantic. */
  speed?: number;
  className?: string;
}

export default function AnimatedTexture({
  kind = "marble",
  speed = 1,
  className,
}: AnimatedTextureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = SIZE;
    canvas.height = SIZE;
    const field = FIELDS[kind] ?? FIELDS.marble;
    const image = ctx.createImageData(SIZE, SIZE);
    const data = image.data;

    const draw = (t: number) => {
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const v = Math.max(0, Math.min(1, field(x, y, t, SIZE)));
          const dither = (BAYER[y % 8][x % 8] / 64 - 0.5) * 0.16;
          const idx = Math.max(
            0,
            Math.min(RAMP.length - 1, Math.round((v + dither) * (RAMP.length - 1)))
          );
          const [r, g, b] = RAMP[idx];
          const i = (y * SIZE + x) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    // Reduced motion: paint one frame and leave it there.
    // matchMedia is missing under jsdom, so guard rather than assume it.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      draw(0);
      return;
    }

    let raf = 0;
    let last = 0;
    let onScreen = true;

    const tick = (now: number) => {
      if (!onScreen || document.visibilityState === "hidden") {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      draw((now / 1000) * speed);
    };

    // Don't burn frames on a texture that's scrolled out of view.
    const io = new IntersectionObserver((entries) => {
      const wasOn = onScreen;
      onScreen = entries[0].isIntersecting;
      if (onScreen && !wasOn && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && onScreen && !raf) {
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [kind, speed]);

  // Layout lives on the wrapper, never the canvas: styles/loader.css carries a
  // legacy global `canvas { fixed; top-0; left-0; z-[-1] }` that would other-
  // wise rip this out of the layout. data-animated-texture opts back out (see
  // the escape rule in globals.css).
  return (
    <div data-animated-texture aria-hidden className={className}>
      <canvas ref={canvasRef} className="block w-full h-full [image-rendering:pixelated]" />
    </div>
  );
}
