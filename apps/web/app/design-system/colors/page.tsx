import { DsSection } from "@/components/studio/ds/blocks";
import ColorRamp from "@/components/studio/ds/ColorRamp";
import {
  INK_RAMP,
  ROLE_COLORS,
  SEMANTIC_MAP,
} from "@/constants/studio-colors";

export default function ColorsPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="type-h1">Colors</h1>
        <p className="type-lead mt-3 max-w-2xl">
          One scale, two accents, one red. Ink is the base of the app — cobalt
          and mint do the rest.
        </p>
        <div className="type-label text-muted-foreground mt-4">
          Format: HSL · click any swatch to copy
        </div>
      </div>

      {/* ── 01 How the system works ─────────────────────────────── */}
      <DsSection index="01" title="The system at a glance">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr]">
            {/* the 60/30 field */}
            <div className="bg-paper p-8 min-h-[220px] flex flex-col justify-between">
              <div>
                <div className="type-label text-ink/50">~60% — PAPER (INK-50)</div>
                <div className="type-h3 text-ink mt-1">
                  Almost everything is paper…
                </div>
              </div>
              <div className="bg-ink rounded-lg p-5 mt-6">
                <div className="type-label text-paper/50">
                  ~30% — INK (INK-950)
                </div>
                <div className="type-p text-paper mt-1">
                  …written on with ink: text, dark surfaces, the player at
                  night.
                </div>
              </div>
            </div>
            {/* the 10% accents */}
            <div className="bg-card p-8 border-t md:border-t-0 md:border-l border-border flex flex-col justify-center gap-4">
              <div className="type-label text-muted-foreground">
                ~10% — THE ACCENTS
              </div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-md bg-cobalt shrink-0 shadow-e1" />
                <div>
                  <div className="type-small">Cobalt acts</div>
                  <div className="type-muted">buttons · links · focus</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-md bg-mint shrink-0 shadow-e1" />
                <div>
                  <div className="type-small">Mint lives</div>
                  <div className="type-muted">now playing · success</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-md bg-destructive shrink-0 shadow-e1" />
                <div>
                  <div className="type-small">Red warns</div>
                  <div className="type-muted">delete · errors — nothing else</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DsSection>

      {/* ── 02 The ink scale ────────────────────────────────────── */}
      <DsSection index="02" title="Ink — the base scale">
        <p className="type-muted mb-5 max-w-2xl">
          The only scale in the system. It runs from Paper to Ink — every
          surface, hairline, and text tone is one of these 11 steps.
        </p>
        <ColorRamp
          name="ink"
          steps={INK_RAMP}
          anchors={{ 50: "= PAPER #F7F6F3", 950: "= INK #191919" }}
        />
      </DsSection>

      {/* ── 03 Role colors ──────────────────────────────────────── */}
      <DsSection index="03" title="Role colors — single values, no shades">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ROLE_COLORS.map((c) => (
            <div
              key={c.name}
              className="rounded-lg border border-border overflow-hidden bg-card"
            >
              <div className={`${c.chipClass} p-5 h-32 flex flex-col justify-between`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="type-h4">{c.name}</span>
                  <span className="type-label opacity-80">{c.role}</span>
                </div>
                <div>
                  <div className="type-data-md">{c.hex}</div>
                  <div className="type-label opacity-70 mt-0.5">{c.hsl}</div>
                </div>
              </div>
              <div className="p-5 grid gap-3">
                <div>
                  <div className="type-label text-primary">
                    USE FOR
                  </div>
                  <div className="type-small mt-1.5 leading-5">
                    {c.do.join(" · ")}
                  </div>
                </div>
                <div>
                  <div className="type-label text-destructive">NEVER FOR</div>
                  <div className="type-small mt-1.5 leading-5 text-muted-foreground">
                    {c.dont.join(" · ")}
                  </div>
                </div>
                <div className="type-muted pt-1 border-t border-border">
                  {c.darkNote}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 04 Semantic tokens ──────────────────────────────────── */}
      <DsSection index="04" title="Semantic tokens">
        <p className="type-muted mb-5 max-w-xl">
          Components speak in tokens, never raw values. Chips show what each
          token resolves to in light and dark.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1.3fr_1fr_1fr] sm:grid-cols-[1.3fr_1.4fr_1fr_1fr] gap-x-4 px-4 py-2.5 bg-secondary type-label text-muted-foreground">
            <div>Token</div>
            <div className="hidden sm:block">Usage</div>
            <div>Light</div>
            <div>Dark</div>
          </div>
          {SEMANTIC_MAP.map((row) => (
            <div
              key={row.token}
              className="grid grid-cols-[1.3fr_1fr_1fr] sm:grid-cols-[1.3fr_1.4fr_1fr_1fr] gap-x-4 px-4 py-3 border-t border-border items-center"
            >
              <div className="type-code inline-block w-fit">--{row.token}</div>
              <div className="type-muted hidden sm:block">{row.usage}</div>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-5 h-5 rounded-sm border border-border shrink-0"
                  style={{ backgroundColor: row.light }}
                />
                <span className="type-data-sm text-muted-foreground truncate">
                  {row.light.replace("hsl(", "").replace(")", "")}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-5 h-5 rounded-sm border border-border shrink-0"
                  style={{ backgroundColor: row.dark }}
                />
                <span className="type-data-sm text-muted-foreground truncate">
                  {row.dark.replace("hsl(", "").replace(")", "")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DsSection>
    </div>
  );
}
