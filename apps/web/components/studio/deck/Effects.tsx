// apps/web/components/studio/deck/Effects.tsx
"use client";

import { Vector2 } from "three";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Glitch,
  Noise,
  Scanline,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, GlitchMode } from "postprocessing";

const ABERRATION_OFFSET = new Vector2(0.0012, 0.0008);
const GLITCH_DELAY = new Vector2(0.05, 0.25);
const GLITCH_DURATION = new Vector2(0.08, 0.22);
const GLITCH_STRENGTH = new Vector2(0.12, 0.4);

/**
 * 80s anime retrotech grade: grain, edge-weighted chromatic aberration,
 * faint scanlines, vignette, low bloom for the LEDs and blue highlights,
 * and a VHS tracking-error glitch that fires only during swaps.
 */
export default function DeckEffects({ glitch }: { glitch: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.4}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={ABERRATION_OFFSET}
        radialModulation
        modulationOffset={0.35}
      />
      <Scanline blendFunction={BlendFunction.OVERLAY} density={1.3} opacity={0.07} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.4} />
      <Vignette eskil={false} offset={0.22} darkness={0.78} />
      <Glitch
        active={glitch}
        mode={GlitchMode.SPORADIC}
        delay={GLITCH_DELAY}
        duration={GLITCH_DURATION}
        strength={GLITCH_STRENGTH}
        ratio={0.55}
      />
    </EffectComposer>
  );
}
