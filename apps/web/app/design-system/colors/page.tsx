import { DsSection } from "@/components/studio/ds/blocks";
import ColorRamp from "@/components/studio/ds/ColorRamp";
import {
  INK_RAMP,
  COBALT_SHADES,
  MINT_SHADES,
  SEMANTIC_MAP,
  type Shade,
} from "@/constants/studio-colors";

/** One big readable shade card. */
function ShadeCard({ shade }: { shade: Shade }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div
        className={`h-28 p-5 flex flex-col justify-between ${shade.textClass}`}
        style={{ backgroundColor: shade.hsl }}
      >
        <div className="type-h4">{shade.name}</div>
        <div className="type-data-md">{shade.hex}</div>
      </div>
      <div className="p-4 bg-card">
        <div className="type-code inline-block">{shade.tw}</div>
        <div className="type-data-sm text-muted-foreground mt-2">
          {shade.hsl.replace("hsl(", "").replace(")", "")}
        </div>
        <p className="type-small mt-2 leading-5">{shade.use}</p>
      </div>
    </div>
  );
}

export default function ColorsPage() {
  return (
    <div>
      <div className="mb-14">
        <h1 className="type-h1">Colors</h1>
        <p className="type-lead mt-3 max-w-2xl">
          Ink is the base. Cobalt acts. Mint lives. Red only warns.
        </p>
        <div className="type-label text-muted-foreground mt-4">
          FORMAT: HSL · CLICK INK SWATCHES TO COPY
        </div>
      </div>

      {/* ── 01 Ink ──────────────────────────────────────────────── */}
      <DsSection index="01" title="Ink — the base">
        <p className="type-p mb-6 max-w-2xl">
          The only scale. Snow at 50, Ink at 950 — every surface, hairline and
          text tone in the app is one of these 11 steps.
        </p>
        <ColorRamp
          name="ink"
          steps={INK_RAMP}
          anchors={{ 50: "= SNOW #F7F6F3", 950: "= INK #191919" }}
        />
      </DsSection>

      {/* ── 02 Cobalt ───────────────────────────────────────────── */}
      <DsSection index="02" title="Cobalt — action">
        <p className="type-p mb-6 max-w-2xl">
          Anything the user can do is cobalt: buttons, links, focus, active
          navigation. Three shades, nothing more.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {COBALT_SHADES.map((s) => (
            <ShadeCard key={s.tw} shade={s} />
          ))}
        </div>
      </DsSection>

      {/* ── 03 Mint ─────────────────────────────────────────────── */}
      <DsSection index="03" title="Mint — life">
        <p className="type-p mb-6 max-w-2xl">
          Anything alive is mint: the track playing now, the EQ bars, success,
          growth. Three shades, nothing more.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {MINT_SHADES.map((s) => (
            <ShadeCard key={s.tw} shade={s} />
          ))}
        </div>
      </DsSection>

      {/* ── 04 Destructive ──────────────────────────────────────── */}
      <DsSection index="04" title="Destructive — warnings only">
        <div className="rounded-lg border border-border bg-card p-5 flex flex-wrap items-center gap-5 max-w-2xl">
          <span className="w-14 h-14 rounded-md bg-destructive shrink-0 shadow-e1" />
          <div className="min-w-0">
            <div className="type-large">One red. No shades.</div>
            <p className="type-muted mt-1">
              Delete actions and error states — never emphasis, never
              decoration, never badges.
            </p>
          </div>
          <div className="ml-auto">
            <div className="type-code inline-block">destructive</div>
            <div className="type-data-sm text-muted-foreground mt-1.5">
              0 84% 60%
            </div>
          </div>
        </div>
      </DsSection>

      {/* ── 05 Tokens ───────────────────────────────────────────── */}
      <DsSection index="05" title="Semantic tokens">
        <p className="type-p mb-6 max-w-2xl">
          Components speak in tokens, never raw values. Chips show what each
          token becomes in light and dark.
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
