import { DsSection } from "@/components/studio/ds/blocks";
import ColorRamp from "@/components/studio/ds/ColorRamp";
import { RAMPS, SEMANTIC_MAP } from "@/constants/studio-colors";

const ANCHORS = [
  { name: "Ink", hex: "#191919", cls: "bg-ink text-paper", pos: "ink-950" },
  { name: "Cobalt", hex: "#1450F0", cls: "bg-cobalt text-paper", pos: "cobalt-600" },
  { name: "Mint", hex: "#7DF08A", cls: "bg-mint text-ink", pos: "mint-400" },
  { name: "Paper", hex: "#F7F6F3", cls: "bg-paper text-ink border border-border", pos: "ink-50" },
];

export default function ColorsPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="type-h1">Colors</h1>
        <p className="type-lead mt-3 max-w-2xl">
          Four brand anchors, four full scales. Every color in the app is one
          of these steps — no hue exists outside this page.
        </p>
        <div className="type-label text-muted-foreground mt-4">
          Format: HSL · click any swatch to copy
        </div>
      </div>

      {/* ── 01 Brand anchors ────────────────────────────────────── */}
      <DsSection index="01" title="Brand anchors">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ANCHORS.map((a) => (
            <div key={a.name} className={`rounded-lg p-5 h-36 flex flex-col justify-between shadow-e1 ${a.cls}`}>
              <div className="type-h4">{a.name}</div>
              <div>
                <div className="type-data">{a.hex}</div>
                <div className="type-label opacity-70 mt-0.5">= {a.pos}</div>
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 02 The scales ───────────────────────────────────────── */}
      <DsSection index="02" title="The scales">
        {RAMPS.map((ramp) => (
          <ColorRamp key={ramp.name} ramp={ramp} />
        ))}
      </DsSection>

      {/* ── 03 Semantic tokens ──────────────────────────────────── */}
      <DsSection index="03" title="Semantic tokens">
        <p className="type-muted mb-6 max-w-xl">
          Components never name raw steps — they use semantic tokens, which
          point at ramp positions per theme.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr] gap-x-4 px-4 py-2.5 bg-secondary type-label text-muted-foreground">
            <div>Token</div>
            <div>Light</div>
            <div>Dark</div>
            <div className="hidden sm:block">Usage</div>
          </div>
          {SEMANTIC_MAP.map((row) => (
            <div
              key={row.token}
              className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr] gap-x-4 px-4 py-3 border-t border-border items-baseline"
            >
              <div className="type-code inline-block w-fit">--{row.token}</div>
              <div className="type-small">{row.light}</div>
              <div className="type-small">{row.dark}</div>
              <div className="type-muted hidden sm:block">{row.usage}</div>
            </div>
          ))}
        </div>
        <p className="type-muted mt-6 max-w-xl">
          Ratio rule stands: ~60% ink-50 (paper), ~30% ink-950, ~10% cobalt +
          mint. Signal red only where something breaks or dies.
        </p>
      </DsSection>
    </div>
  );
}
