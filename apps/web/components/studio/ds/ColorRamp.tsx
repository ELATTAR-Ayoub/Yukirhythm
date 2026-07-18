"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RampStep } from "@/constants/studio-colors";

/** Perceived-light check for label contrast on a swatch. */
function isLight(hsl: string): boolean {
  const m = hsl.match(/(\d+(?:\.\d+)?)%\)$/);
  return m ? parseFloat(m[1]) > 55 : false;
}

interface ColorRampProps {
  name: string;
  steps: RampStep[];
  /** step → short label, rendered under the anchor swatches */
  anchors?: Record<number, string>;
}

/** A shadcn-style color scale row — click any swatch to copy its HSL. */
export default function ColorRamp({ name, steps, anchors = {} }: ColorRampProps) {
  const [copied, setCopied] = useState<number | null>(null);

  const copy = (step: number, hsl: string) => {
    navigator.clipboard?.writeText(hsl).catch(() => {});
    setCopied(step);
    setTimeout(() => setCopied((s) => (s === step ? null : s)), 1200);
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2">
      {steps.map(({ step, hsl }) => {
        const light = isLight(hsl);
        const anchor = anchors[step];
        return (
          <button
            key={step}
            onClick={() => copy(step, hsl)}
            title={`Copy ${hsl}`}
            className={cn(
              "group text-left rounded-md overflow-hidden border transition-transform duration-fast active:scale-95",
              anchor ? "border-foreground/60 ring-1 ring-foreground/30" : "border-border"
            )}
          >
            <div className="h-16 flex items-end p-1.5" style={{ backgroundColor: hsl }}>
              <span
                className={cn(
                  "type-data-sm opacity-0 group-hover:opacity-100 transition-opacity duration-fast",
                  light ? "text-ink" : "text-snow"
                )}
              >
                {copied === step ? "COPIED" : "COPY"}
              </span>
            </div>
            <div className="px-1.5 py-1.5 bg-card">
              <div className="type-label">
                {name}-{step}
              </div>
              <div className="type-data-sm text-muted-foreground truncate">
                {hsl.replace("hsl(", "").replace(")", "")}
              </div>
              {anchor ? (
                <div className="type-label text-primary mt-0.5 truncate">{anchor}</div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
