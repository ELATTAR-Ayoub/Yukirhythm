import Texture, { TEXTURE_NAMES } from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import {
  DsSection,
  TokenSwatch,
  SpecimenBlock,
  DemoCell,
} from "@/components/studio/ds/blocks";
import AgentGallery from "@/components/studio/ds/AgentGallery";

const ICONS = [
  "play",
  "pause",
  "next",
  "previous",
  "search",
  "menu",
  "delete",
  "load",
  "cross_plus",
  "email",
  "github",
  "google",
] as const;

/** Pixel-cluster decoration recreated from the brand card (checker diamonds). */
function PixelCluster({ flip = false }: { flip?: boolean }) {
  const cell = "w-7 h-7 sm:w-9 sm:h-9";
  return (
    <div
      className={`grid grid-cols-3 gap-1 ${flip ? "rotate-180" : ""}`}
      aria-hidden
    >
      <Texture name="tx-k2-checker" className={cell} />
      <div />
      <Texture name="tx-k-ripple" className={cell} />
      <div />
      <Texture name="tx-k2-vinyl" className={cell} />
      <div />
      <Texture name="tx-k2-bars" className={cell} />
      <div />
      <div />
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div>
      {/* ── Brand hero — the wordmark card vibe ─────────────────── */}
      <section className="relative mb-16 rounded-lg border border-border bg-background overflow-hidden">
        <div className="absolute top-5 left-5">
          <PixelCluster />
        </div>
        <div className="absolute bottom-5 right-5">
          <PixelCluster flip />
        </div>
        <div className="py-28 sm:py-36 flex flex-col items-center justify-center text-center px-6">
          <h1 className="font-pixel text-4xl sm:text-6xl tracking-tight">
            Yuki Rhythm
          </h1>
          <p className="mt-4 font-label text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Studio palette · 191919 / 1450F0 / 7DF08A / F7F6F3
          </p>
        </div>
      </section>

      {/* ── 01 Color ─────────────────────────────────────────────── */}
      <DsSection index="01" title="Color">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <TokenSwatch name="Ink" value="#191919" swatchClassName="bg-ink" />
          <TokenSwatch
            name="Cobalt"
            value="#1450F0"
            swatchClassName="bg-cobalt"
          />
          <TokenSwatch name="Mint" value="#7DF08A" swatchClassName="bg-mint" />
          <TokenSwatch
            name="Paper"
            value="#F7F6F3"
            swatchClassName="bg-paper"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <TokenSwatch
            name="Primary"
            value="actions · links · focus"
            swatchClassName="bg-primary"
          />
          <TokenSwatch
            name="Accent"
            value="success · now playing"
            swatchClassName="bg-accent"
          />
          <TokenSwatch
            name="Muted"
            value="dividers · quiet fills"
            swatchClassName="bg-muted"
          />
          <TokenSwatch
            name="Destructive"
            value="delete · errors"
            swatchClassName="bg-destructive"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-6 max-w-xl">
          Ratio rule: ~60% paper, ~30% ink, ~10% cobalt + mint. Tints are alpha
          variants of the four bases — no new hues.
        </p>
      </DsSection>

      {/* ── 02 Typography ────────────────────────────────────────── */}
      <DsSection index="02" title="Typography">
        <SpecimenBlock
          role="Display"
          font="Satoshi Bold / Black"
          usage="Page titles, track titles, hero cards."
        >
          <div className="font-display font-bold text-4xl sm:text-5xl tracking-tight leading-none">
            Music becomes weather
          </div>
        </SpecimenBlock>
        <SpecimenBlock
          role="Interface"
          font="Satoshi Regular / Medium"
          usage="Buttons, navigation, body text, settings."
        >
          <p className="font-ui text-base max-w-lg">
            Search your rhythm, build playlists that matter, and let the agent
            find what you did not know you loved.
          </p>
        </SpecimenBlock>
        <SpecimenBlock
          role="Pixel label"
          font="OffBit Regular / Bold"
          usage="Wordmark, section labels, catalogue tags."
        >
          <div className="font-pixel text-2xl">
            LIKED AUDIO · NEW RELEASES · YUKI RHYTHM
          </div>
        </SpecimenBlock>
        <SpecimenBlock
          role="Data"
          font="OffBit Dot"
          usage="Timestamps, BPM, counters — every number in the app."
        >
          <DataText className="text-3xl">
            01:24 / 03:45 · 132 BPM · 4,209 PLAYS
          </DataText>
        </SpecimenBlock>
        <SpecimenBlock
          role="CJK fallback"
          font="Noto Sans JP"
          usage="The library is full of JP/CN titles — always in the stack."
        >
          <div className="font-display font-medium text-2xl">
            岸田教団 — literal world · 蔡健雅 — 夜盲症
          </div>
        </SpecimenBlock>
      </DsSection>

      {/* ── 03 Spacing & Radius ──────────────────────────────────── */}
      <DsSection index="03" title="Spacing & Radius">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <DemoCell label="Base unit" sub="4px scale · 4/8/12/16/24/32/48/64">
            <div className="flex items-end gap-1.5">
              {[4, 8, 12, 16, 24, 32].map((s) => (
                <div
                  key={s}
                  className="bg-cobalt/80 w-4 rounded-sm"
                  style={{ height: s }}
                />
              ))}
            </div>
          </DemoCell>
          <DemoCell label="radius-sm" sub="12px — chips, inputs">
            <div className="w-20 h-14 bg-secondary rounded-sm border border-border" />
          </DemoCell>
          <DemoCell label="radius-md" sub="14px — buttons, rows">
            <div className="w-20 h-14 bg-secondary rounded-md border border-border" />
          </DemoCell>
          <DemoCell label="radius-lg" sub="16px — cards, panels">
            <div className="w-20 h-14 bg-secondary rounded-lg border border-border" />
          </DemoCell>
        </div>
      </DsSection>

      {/* ── 04 Elevation ─────────────────────────────────────────── */}
      <DsSection index="04" title="Elevation">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <DemoCell label="e1" sub="flat — rows, chips">
            <div className="w-20 h-14 bg-card rounded-lg shadow-e1" />
          </DemoCell>
          <DemoCell label="e2" sub="raised — cards">
            <div className="w-20 h-14 bg-card rounded-lg shadow-e2" />
          </DemoCell>
          <DemoCell label="e3" sub="floating — player bar, popovers">
            <div className="w-20 h-14 bg-card rounded-lg shadow-e3" />
          </DemoCell>
          <DemoCell label="e4" sub="modal — dialogs, agent panel">
            <div className="w-20 h-14 bg-card rounded-lg shadow-e4" />
          </DemoCell>
        </div>
      </DsSection>

      {/* ── 05 Motion ────────────────────────────────────────────── */}
      <DsSection index="05" title="Motion">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <DemoCell label="fast · 150ms" sub="hover, focus — ease-out">
            <div className="w-14 h-14 bg-cobalt rounded-lg transition-transform duration-fast hover:-translate-y-1.5 cursor-pointer" />
          </DemoCell>
          <DemoCell label="base · 250ms" sub="cards, chips — ease-out">
            <div className="w-14 h-14 bg-cobalt rounded-lg transition-all duration-base hover:rounded-[28px] hover:bg-mint cursor-pointer" />
          </DemoCell>
          <DemoCell label="slow · 400ms" sub="panels, page moods">
            <div className="w-14 h-14 bg-cobalt rounded-lg transition-all duration-slow hover:scale-110 hover:rotate-45 cursor-pointer" />
          </DemoCell>
          <DemoCell label="press" sub="squish on active">
            <div className="w-14 h-14 bg-ink dark:bg-paper rounded-lg transition-transform duration-fast active:scale-90 cursor-pointer" />
          </DemoCell>
        </div>
        <p className="text-sm text-muted-foreground mt-6 max-w-xl">
          Hover the boxes. Rule: motion communicates state, never decorates.
          One property per transition where possible.
        </p>
      </DsSection>

      {/* ── 06 Iconography ───────────────────────────────────────── */}
      <DsSection index="06" title="Iconography">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-4">
          {ICONS.map((icon) => (
            <div key={icon} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-md bg-card border border-border shadow-e1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/svgs/${icon}.svg`} alt={icon} className="w-5 h-5" />
              </div>
              <div className="font-label text-[9px] text-muted-foreground">
                {icon}
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 07 Textures ──────────────────────────────────────────── */}
      <DsSection index="07" title="Textures">
        <p className="text-sm text-muted-foreground mb-6 max-w-xl">
          The dithered branding pack — placeholder artwork, page backdrops,
          empty states, pixel clusters. Rendered pixelated, never smoothed.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {TEXTURE_NAMES.map((name) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Texture
                name={name}
                className="aspect-square rounded-md border border-border"
              />
              <div className="font-label text-[9px] text-muted-foreground truncate">
                {name}
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 08 Agent ─────────────────────────────────────────────── */}
      <DsSection index="08" title="Agent states">
        <p className="text-sm text-muted-foreground mb-6 max-w-xl">
          The Yuki agent — a dithered canvas companion. It reflects app state
          everywhere: searching, downloading, playing, recommending. Live
          below.
        </p>
        <AgentGallery />
      </DsSection>
    </div>
  );
}
