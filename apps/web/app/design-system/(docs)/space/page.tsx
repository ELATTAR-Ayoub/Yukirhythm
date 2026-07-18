import { DsSection } from "@/components/studio/ds/blocks";
import MotionLab from "@/components/studio/ds/MotionLab";

const SPACING = [
  { token: "space-1", px: 4, use: "icon gaps, chip padding" },
  { token: "space-2", px: 8, use: "inside buttons, row gaps" },
  { token: "space-3", px: 12, use: "card padding (tight)" },
  { token: "space-4", px: 16, use: "card padding, grid gaps" },
  { token: "space-6", px: 24, use: "between components" },
  { token: "space-8", px: 32, use: "between groups" },
  { token: "space-12", px: 48, use: "between page sections" },
  { token: "space-16", px: 64, use: "page tops, hero air" },
];

const RADII = [
  { token: "radius-sm", px: 12, use: "chips, inputs, thumbnails" },
  { token: "radius-md", px: 14, use: "buttons, rows" },
  { token: "radius-lg", px: 16, use: "cards, panels, dialogs" },
];

const ELEVATIONS = [
  { cls: "shadow-e1", name: "e1 — resting", use: "rows, chips, flat tiles" },
  { cls: "shadow-e2", name: "e2 — raised", use: "cards, shelves" },
  { cls: "shadow-e3", name: "e3 — floating", use: "player bar, popovers" },
  { cls: "shadow-e4", name: "e4 — overhead", use: "dialogs, agent panel" },
];

export default function SpacePage() {
  return (
    <div>
      <div className="mb-14">
        <h1 className="type-h1">Space &amp; Motion</h1>
        <p className="type-lead mt-3 max-w-2xl">
          How far apart things sit, how high they float, and how they move.
          The app is a machine: surfaces cast real shadows, controls click,
          content springs.
        </p>
      </div>

      {/* ── 01 Spacing ──────────────────────────────────────────── */}
      <DsSection index="01" title="Spacing — the 4px grid">
        <p className="type-p mb-6 max-w-2xl">
          Every distance is a multiple of 4. Eight named steps cover the whole
          app — if a gap is not on this list, it is wrong.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          {SPACING.map((s) => (
            <div
              key={s.token}
              className="grid grid-cols-[110px_70px_1fr_1.2fr] items-center gap-x-4 px-4 py-3 border-b border-border last:border-b-0"
            >
              <div className="type-code inline-block w-fit">{s.token}</div>
              <div className="type-data text-primary">{s.px}px</div>
              <div className="h-4 flex items-center">
                <span
                  className="h-3 bg-cobalt rounded-[2px]"
                  style={{ width: s.px }}
                />
              </div>
              <div className="type-muted hidden sm:block">{s.use}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8">
          {RADII.map((r) => (
            <div
              key={r.token}
              className="rounded-lg border border-border bg-card p-5 flex items-center gap-4"
            >
              <div
                className="w-16 h-16 bg-secondary border border-border shrink-0"
                style={{ borderRadius: r.px }}
              />
              <div className="min-w-0">
                <div className="type-code inline-block">{r.token}</div>
                <div className="type-data-sm text-primary mt-1.5">{r.px}px</div>
                <div className="type-muted mt-1">{r.use}</div>
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 02 Elevation ────────────────────────────────────────── */}
      <DsSection index="02" title="Elevation — realistic shadows">
        <p className="type-p mb-6 max-w-2xl">
          Every shadow has two parts, like the real world: a tight dark
          contact shadow where the object meets the surface, and a soft
          ambient falloff that grows with height.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {ELEVATIONS.map((e) => (
            <div key={e.cls} className="flex flex-col gap-3">
              <div className="h-36 rounded-lg bg-background border border-border flex items-center justify-center">
                <div className={`w-20 h-20 rounded-lg bg-card ${e.cls}`} />
              </div>
              <div>
                <div className="type-h4">{e.name}</div>
                <div className="type-code inline-block mt-1.5">{e.cls}</div>
                <div className="type-muted mt-1">{e.use}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="type-label text-primary mb-4">
          MACHINE SURFACES — BUTTONS WITH REAL DEPTH
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="rounded-lg border border-border bg-background p-6 flex flex-col items-center gap-4">
            <button className="press-key w-24 h-16 rounded-md bg-card border border-border type-small">
              PRESS ME
            </button>
            <div className="text-center">
              <div className="type-code inline-block">shadow-key</div>
              <div className="type-muted mt-1">
                raised key with visible side wall — press it
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-6 flex flex-col items-center gap-4">
            <div className="w-24 h-16 rounded-md bg-secondary shadow-pressed flex items-center justify-center type-small text-muted-foreground">
              PRESSED
            </div>
            <div className="text-center">
              <div className="type-code inline-block">shadow-pressed</div>
              <div className="type-muted mt-1">
                sunken socket — active toggles, wells
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-6 flex flex-col items-center gap-4">
            <div className="main_shadow w-24 h-16 rounded-md flex items-center justify-center type-small">
              LEGACY
            </div>
            <div className="text-center">
              <div className="type-code inline-block">main_shadow</div>
              <div className="type-muted mt-1">
                your original neumorphic surface — kept
              </div>
            </div>
          </div>
        </div>
      </DsSection>

      {/* ── 03 Motion ───────────────────────────────────────────── */}
      <DsSection index="03" title="Motion — springs & machines">
        <p className="type-p mb-8 max-w-2xl">
          Two families. <b>Springy</b>: elastic, overshoots and settles like a
          spring — fun to click, fun to watch appear. <b>Machine</b>: stepped
          and physical like old hardware — keys travel, discs ratchet, screens
          flicker on. Click every tile.
        </p>
        <MotionLab />
      </DsSection>
    </div>
  );
}
