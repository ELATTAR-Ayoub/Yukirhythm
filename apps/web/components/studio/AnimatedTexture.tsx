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

/** Dithered fields — rendered into a small buffer and scaled up. */
export const DITHER_TEXTURE_KINDS = [
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

/** Glyph fields — drawn as monospace characters at native resolution. */
export const ASCII_TEXTURE_KINDS = [
  "ascii-eq",
  "ascii-rain",
  "ascii-vortex",
  "ascii-pulse",
  "ascii-dunes",
  "ascii-wave",
] as const;

export const ANIMATED_TEXTURE_KINDS = [
  ...DITHER_TEXTURE_KINDS,
  ...ASCII_TEXTURE_KINDS,
] as const;

export type DitherTextureKind = (typeof DITHER_TEXTURE_KINDS)[number];
export type AsciiTextureKind = (typeof ASCII_TEXTURE_KINDS)[number];
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
    v +=
      a *
      Math.sin(
        x * f +
          warp * Math.sin(y * f * 1.7 + o * 2.1 + t * 0.6) +
          o * 5 +
          t * 0.4
      );
    a *= 0.55;
    f *= 2.1;
  }
  return v;
}

type FieldFn = (x: number, y: number, t: number, S: number) => number;

const FIELDS: Record<DitherTextureKind, FieldFn> = {
  marble: (x, y, t) => (marbleAt(x * 1.6, y * 1.6, t) + 2) / 4,
  ripple: (x, y, t, S) => {
    const dx = x - S / 2;
    const dy = y - S / 2;
    const r = Math.sqrt(dx * dx + dy * dy);
    return (
      Math.sin(r * 0.14 - t * 2.2 + marbleAt(x, y, t * 0.3) * 1.2) * 0.5 + 0.5
    );
  },
  vinyl: (x, y, t, S) => {
    const dx = x - S / 2;
    const dy = y - S / 2;
    const r = Math.sqrt(dx * dx + dy * dy);
    const a = Math.atan2(dy, dx);
    return (
      (Math.sin(r * 0.55 - t * 1.5) * 0.5 + 0.5) * 0.35 +
      (Math.sin(
        r * 0.06 + Math.sin(a * 3 + t) * 0.5 + marbleAt(x, y, 0) * 0.4
      ) *
        0.5 +
        0.5) *
        0.65
    );
  },
  bars: (x, y, t, S) => {
    const col = Math.floor(x / (S / 22));
    const hgt =
      (Math.sin(col * 2.7 + t * 1.8) * 0.5 + 0.5) * 0.6 +
      0.18 +
      Math.sin(col * 13.7 + t * 3.1) * 0.12;
    return (S - y) / S < hgt
      ? 0.65 + marbleAt(x * 4, y * 4, t * 0.5) * 0.15
      : 0.08;
  },
  static: (x, y, t) => {
    const row = Math.sin(y * 0.7 + t * 8) * 0.5 + 0.5;
    let v =
      Math.random() * 0.55 * row +
      ((marbleAt(x * 3, y * 0.5, t) + 2) / 4) * 0.45;
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
  lava: (x, y, t) =>
    (marbleAt(x * 2.4 + t * 14, y * 2.4 - t * 9, t * 0.8, 4.5) + 2) / 4,
  scanline: (x, y, t, S) => {
    const wave =
      Math.sin(x * 0.06 + marbleAt(x, y, t * 0.4) * 1.4 + t * 1.2) * 0.5 + 0.5;
    const sweep = Math.max(0, 1 - Math.abs((y / S - ((t * 0.35) % 1.3)) * 6));
    return Math.min(1, wave * 0.65 + sweep * 0.5);
  },
  moire: (x, y, t) => {
    const a =
      Math.sin(x * 0.32 + Math.sin(t * 0.7) * 2) *
      Math.sin(y * 0.32 + Math.cos(t * 0.9) * 2);
    const b = Math.sin((x * Math.cos(t * 0.3) - y * Math.sin(t * 0.3)) * 0.28);
    return (a + b) / 4 + 0.5;
  },
};

const SIZE = 110;
const FRAME_MS = 50; // ~20fps, deliberate stepped feel

/** Small buffer, Bayer-dithered onto the ramp, scaled up pixelated. */
function makeDitherDraw(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  kind: DitherTextureKind
) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const field = FIELDS[kind] ?? FIELDS.marble;
  const image = ctx.createImageData(SIZE, SIZE);
  const data = image.data;

  return (t: number) => {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const v = Math.max(0, Math.min(1, field(x, y, t, SIZE)));
        const dither = (BAYER[y % 8][x % 8] / 64 - 0.5) * 0.16;
        const idx = Math.max(
          0,
          Math.min(
            RAMP.length - 1,
            Math.round((v + dither) * (RAMP.length - 1))
          )
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
}

const CW = 7; // glyph cell width
const CH = 11; // glyph cell height
const GLYPHS = " .,:;-=+*xX#8@";
const INK = "#191919";

type Drop = { p: number; s: number; l: number };

/**
 * Glyph fields. Unlike the dithered kinds these draw at native resolution —
 * scaling a character grid up would blur the letterforms, which are the point.
 */
function makeAsciiDraw(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  kind: AsciiTextureKind
) {
  let drops: Drop[] | null = null;

  return (t: number) => {
    const W = canvas.clientWidth || 600;
    const H = canvas.clientHeight || 300;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    ctx.font = "10px monospace";
    ctx.textBaseline = "top";
    const cols = Math.ceil(W / CW);
    const rows = Math.ceil(H / CH);

    if (kind === "ascii-rain") {
      if (!drops || drops.length !== cols) {
        drops = Array.from({ length: cols }, () => ({
          p: Math.random() * rows * 2 - rows,
          s: 0.3 + Math.random() * 0.9,
          l: 5 + Math.random() * 14,
        }));
      }
      const chars = "01アイウエオカキクケコ+*x8#@";
      for (let x = 0; x < cols; x++) {
        const dr = drops[x];
        dr.p += dr.s;
        if (dr.p - dr.l > rows) {
          dr.p = -Math.random() * rows * 0.5;
          dr.s = 0.3 + Math.random() * 0.9;
          dr.l = 5 + Math.random() * 14;
        }
        for (let y = 0; y < rows; y++) {
          const head = dr.p - y;
          if (head < 0 || head > dr.l) {
            if ((x * 13 + y * 7) % 37 === 0) {
              ctx.fillStyle = "#2e2e2c";
              ctx.fillText(".", x * CW, y * CH);
            }
            continue;
          }
          const fade = 1 - head / dr.l;
          ctx.fillStyle =
            head < 1
              ? "#f7f6f3"
              : head < 3
                ? "#7df08a"
                : fade > 0.5
                  ? "#1450f0"
                  : "#10327a";
          ctx.fillText(
            chars[
              Math.floor(
                Math.abs(Math.sin(x * 99 + y * 31 + Math.floor(t * 6))) *
                  chars.length
              ) % chars.length
            ],
            x * CW,
            y * CH
          );
        }
      }
      return;
    }

    if (kind === "ascii-vortex") {
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const dx = (x - cols / 2) * CW;
          const dy = (y - rows / 2) * CH;
          const r = Math.sqrt(dx * dx + dy * dy) + 1;
          const a = Math.atan2(dy, dx);
          let v = Math.sin(a * 3 + r * 0.045 - t * 2.2) * 0.5 + 0.5;
          v *= Math.max(0.15, 1 - r / (rows * CH * 0.7));
          if (v < 0.1) {
            if ((x * 11 + y * 5) % 43 === 0) {
              ctx.fillStyle = "#2e2e2c";
              ctx.fillText(".", x * CW, y * CH);
            }
            continue;
          }
          ctx.fillStyle =
            v > 0.8
              ? "#7df08a"
              : v > 0.55
                ? "#1450f0"
                : v > 0.35
                  ? "#90a0f8"
                  : "#4a4a48";
          ctx.fillText(
            GLYPHS[Math.floor(Math.min(0.999, v) * GLYPHS.length)],
            x * CW,
            y * CH
          );
        }
      }
      return;
    }

    if (kind === "ascii-pulse") {
      const beat = Math.pow(Math.max(0, Math.sin(t * 3.2)), 6);
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const dx = (x - cols / 2) * CW;
          const dy = (y - rows / 2) * CH;
          const r = Math.sqrt(dx * dx + dy * dy);
          const ring = Math.abs(r - ((t * 90) % (rows * CH * 0.9)));
          let v =
            Math.max(0, 1 - r / 60) * (0.5 + beat * 0.6) +
            Math.max(0, 1 - ring / 14) * 0.7;
          v = Math.min(1, v);
          if (v < 0.08) {
            if ((x * 7 + y * 13) % 39 === 0) {
              ctx.fillStyle = "#2e2e2c";
              ctx.fillText(".", x * CW, y * CH);
            }
            continue;
          }
          ctx.fillStyle =
            v > 0.85
              ? "#f7f6f3"
              : v > 0.6
                ? "#7df08a"
                : v > 0.35
                  ? "#1450f0"
                  : "#10327a";
          ctx.fillText(
            GLYPHS[Math.floor(Math.min(0.999, v) * GLYPHS.length)],
            x * CW,
            y * CH
          );
        }
      }
      return;
    }

    if (kind === "ascii-dunes") {
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          let v = (marbleAt(x * 9 + t * 26, y * 13, t * 0.5, 4) + 2) / 4;
          v = v * 0.75 + (y / rows) * 0.25;
          const band = Math.abs(((v * 4) % 1) - 0.5) * 2;
          if (band < 0.3) {
            ctx.fillStyle = v > 0.6 ? "#7df08a" : "#1450f0";
            ctx.fillText(v > 0.75 ? "@" : "#", x * CW, y * CH);
          } else {
            const dim = Math.floor(v * GLYPHS.length * 0.55);
            ctx.fillStyle = "#4a4a48";
            if (GLYPHS[dim] !== " ") ctx.fillText(GLYPHS[dim], x * CW, y * CH);
          }
        }
      }
      return;
    }

    if (kind === "ascii-wave") {
      const mid = rows / 2;
      const amp = rows * 0.32;
      for (let x = 0; x < cols; x++) {
        const yw =
          mid +
          Math.sin(x * 0.18 + t * 2.6) * amp * Math.sin(t * 0.9 + x * 0.02) +
          Math.sin(x * 0.07 - t * 1.4) * amp * 0.4;
        const yw2 = mid + Math.sin(x * 0.14 - t * 2) * amp * 0.55;
        for (let y = 0; y < rows; y++) {
          const d1 = Math.abs(y - yw);
          const d2 = Math.abs(y - yw2);
          if (d1 < 1) {
            ctx.fillStyle = "#7df08a";
            ctx.fillText("@", x * CW, y * CH);
          } else if (d1 < 2.5) {
            ctx.fillStyle = "#1450f0";
            ctx.fillText("8", x * CW, y * CH);
          } else if (d2 < 1.2) {
            ctx.fillStyle = "#90a0f8";
            ctx.fillText("x", x * CW, y * CH);
          } else if (Math.abs(y - mid) < 0.6) {
            ctx.fillStyle = "#3c3c3a";
            ctx.fillText("-", x * CW, y * CH);
          } else if ((x * 13 + y * 7) % 41 === 0) {
            ctx.fillStyle = "#2e2e2c";
            ctx.fillText(":", x * CW, y * CH);
          }
        }
      }
      return;
    }

    // ascii-eq — the default: a spectrum of bars made of glyphs
    for (let x = 0; x < cols; x++) {
      const bar =
        (Math.sin(x * 0.5 + t * 1.6) * 0.5 + 0.5) * 0.55 +
        (Math.sin(x * 2.3 + t * 2.7) * 0.5 + 0.5) * 0.3 +
        0.1;
      for (let y = 0; y < rows; y++) {
        const frac = (rows - y) / rows;
        const on = frac < bar;
        const v = on
          ? 0.75 + Math.random() * 0.25
          : 0.06 + Math.random() * 0.08;
        ctx.fillStyle = on
          ? frac > bar - 0.09
            ? "#7df08a"
            : (x * 7 + y) % 9 === 0
              ? "#90a0f8"
              : "#1450f0"
          : "#3c3c3a";
        ctx.fillText(
          GLYPHS[Math.floor(Math.min(0.999, v) * GLYPHS.length)],
          x * CW,
          y * CH
        );
      }
    }
  };
}

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

    const isAscii = kind.startsWith("ascii-");
    const draw = isAscii
      ? makeAsciiDraw(canvas, ctx, kind as AsciiTextureKind)
      : makeDitherDraw(canvas, ctx, kind as DitherTextureKind);

    // Paint immediately rather than waiting on the first frame callback: rAF
    // doesn't run while the tab is hidden, which otherwise leaves a blank
    // canvas on any texture that mounts in a background tab.
    draw(0);

    // Reduced motion: that one frame is the whole animation.
    // matchMedia is missing under jsdom, so guard rather than assume it.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

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
      <canvas
        ref={canvasRef}
        className="block w-full h-full [image-rendering:pixelated]"
      />
    </div>
  );
}
