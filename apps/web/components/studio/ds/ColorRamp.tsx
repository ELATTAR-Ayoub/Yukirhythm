"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Ramp } from "@/constants/studio-colors";

/** Perceived-light check for label contrast on a swatch. */
function isLight(hsl: string): boolean {
  const m = hsl.match(/(\d+(?:\.\d+)?)%\)$/);
  return m ? parseFloat(m[1]) > 55 : false;
}

/** One shadcn-style color scale row: 50→950 swatches, click to copy HSL. */
export default function ColorRamp({ ramp }: { ramp: Ramp }) {
  const [copied, setCopied] = useState<number | null>(null);

  const copy = (step: number, hsl: string) => {
    navigator.clipboard?.writeText(hsl).catch(() => {});
    setCopied(step);
    setTimeout(() => setCopied((s) => (s === step ? null : s)), 1200);
  };

  return (
    <div className="mb-10 last:mb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="type-h4">{ramp.name}</h3>
        {ramp.anchor ? (
          <span className="type-label text-muted-foreground">
            anchor: {ramp.name}-{ramp.anchor.step} · {ramp.anchor.label}
          </span>
        ) : null}
      </div>
      <p className="type-muted mb-4 max-w-2xl">{ramp.description}</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2">
        {ramp.steps.map(({ step, hsl }) => {
          const light = isLight(hsl);
          const isAnchor = ramp.anchor?.step === step;
          return (
            <button
              key={step}
              onClick={() => copy(step, hsl)}
              title={`Copy ${hsl}`}
              className={cn(
                "group text-left rounded-md overflow-hidden border transition-transform duration-fast active:scale-95",
                isAnchor ? "border-foreground/60 ring-1 ring-foreground/30" : "border-border"
              )}
            >
              <div
                className="h-16 flex items-end p-1.5"
                style={{ backgroundColor: hsl }}
              >
                <span
                  className={cn(
                    "type-data-sm opacity-0 group-hover:opacity-100 transition-opacity duration-fast",
                    light ? "text-ink" : "text-paper"
                  )}
                >
                  {copied === step ? "COPIED" : "COPY"}
                </span>
              </div>
              <div className="px-1.5 py-1.5 bg-card">
                <div className="type-label">
                  {ramp.name}-{step}
                  {isAnchor ? " ●" : ""}
                </div>
                <div className="type-data-sm text-muted-foreground truncate">
                  {hsl.replace("hsl(", "").replace(")", "")}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
