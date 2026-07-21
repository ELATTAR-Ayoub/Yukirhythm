"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import AnimatedTexture, {
  ASCII_TEXTURE_KINDS,
  DITHER_TEXTURE_KINDS,
  type AnimatedTextureKind,
} from "@/components/studio/AnimatedTexture";
import Texture, { TEXTURE_NAMES } from "@/components/studio/Texture";
import { DsSection } from "@/components/studio/ds/blocks";
import SectionLabel from "@/components/studio/SectionLabel";

const SPEEDS = [0.5, 1, 2] as const;

function Tile({
  kind,
  speed,
  tall,
}: {
  kind: AnimatedTextureKind;
  speed: number;
  tall?: boolean;
}) {
  return (
    <figure className="min-w-0">
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-ink",
          tall ? "aspect-[4/3]" : "aspect-square"
        )}
      >
        <AnimatedTexture
          kind={kind}
          speed={speed}
          className="absolute inset-0 w-full h-full"
        />
      </div>
      <figcaption className="type-label text-muted-foreground mt-2 normal-case tracking-normal">
        {kind}
      </figcaption>
    </figure>
  );
}

export default function TexturesPage() {
  const [speed, setSpeed] = useState<number>(1);

  return (
    <div className="pb-24">
      <h1 className="type-h1">Textures</h1>
      <p className="type-lead mt-2 max-w-2xl">
        The branding texture pack, running live. Every field is generated in the
        browser from the Studio ramp — nothing here is an image file.
      </p>

      <div className="flex items-center gap-3 mt-6">
        <SectionLabel>Speed</SectionLabel>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "px-3 py-1.5 rounded-md font-ui text-sm transition-colors duration-fast",
                speed === s
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary text-muted-foreground"
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <DsSection index="01" title="Dithered fields">
        <p className="type-muted mb-4 max-w-2xl">
          Drawn into a 110×110 buffer, quantised through an 8×8 Bayer matrix
          onto the six-stop ramp, then scaled up with pixelated rendering. The
          chunky dither is the point, not an artifact.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {DITHER_TEXTURE_KINDS.map((kind) => (
            <Tile key={kind} kind={kind} speed={speed} />
          ))}
        </div>
      </DsSection>

      <DsSection index="02" title="Glyph fields">
        <p className="type-muted mb-4 max-w-2xl">
          Monospace characters drawn at native resolution — scaling a character
          grid would blur the letterforms, which are the whole point. These need
          room to read, so they run wider than the dithered tiles.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ASCII_TEXTURE_KINDS.map((kind) => (
            <Tile key={kind} kind={kind} speed={speed} tall />
          ))}
        </div>
      </DsSection>

      <DsSection index="03" title="Static textures">
        <p className="type-muted mb-4 max-w-2xl">
          The pre-rendered PNG set behind <code className="type-code">Texture</code>
          . These stay static and are what album art and cards use — the live
          fields above are reserved for backdrops and the player.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {TEXTURE_NAMES.map((name) => (
            <figure key={name} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border">
                <Texture name={name} className="absolute inset-0 w-full h-full" />
              </div>
              <figcaption className="type-label text-muted-foreground mt-2 normal-case tracking-normal truncate">
                {name}
              </figcaption>
            </figure>
          ))}
        </div>
      </DsSection>
    </div>
  );
}
