import Link from "next/link";
import Texture, { TEXTURE_NAMES } from "@/components/studio/Texture";
import AnimatedTexture from "@/components/studio/AnimatedTexture";
import { DsSection } from "@/components/studio/ds/blocks";
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

const CHAPTERS = [
  {
    href: "/design-system/typography",
    title: "Typography",
    desc: "Two fonts, hard rule — Satoshi speaks, OffBit computes. 18 named styles.",
    sample: (
      <div className="flex items-baseline gap-3">
        <span className="type-h3">Aa</span>
        <span className="font-pixel font-bold text-2xl">Aa</span>
        <span className="type-data-md text-primary">01:24</span>
      </div>
    ),
  },
  {
    href: "/design-system/colors",
    title: "Colors",
    desc: "Ink is the base. Cobalt acts. Mint lives. Red only warns.",
    sample: (
      <div className="flex gap-2">
        <span className="w-8 h-8 rounded-md bg-snow border border-border" />
        <span className="w-8 h-8 rounded-md bg-ink" />
        <span className="w-8 h-8 rounded-md bg-cobalt" />
        <span className="w-8 h-8 rounded-md bg-mint" />
      </div>
    ),
  },
  {
    href: "/design-system/textures",
    title: "Textures",
    desc: "The branding pack running live — dithered fields and glyph fields.",
    sample: (
      <div className="flex gap-2">
        <AnimatedTexture kind="marble" className="w-8 h-8 rounded-md overflow-hidden" />
        <AnimatedTexture kind="ripple" className="w-8 h-8 rounded-md overflow-hidden" />
        <AnimatedTexture kind="spiral" className="w-8 h-8 rounded-md overflow-hidden" />
      </div>
    ),
  },
  {
    href: "/design-system/space",
    title: "Space & Motion",
    desc: "The 4px grid, realistic machine shadows, springy + mechanical motion.",
    sample: (
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-md bg-card shadow-e3" />
        <span className="w-8 h-8 rounded-md bg-card shadow-key" />
        <span className="w-8 h-8 rounded-full bg-mint anim-jelly" />
      </div>
    ),
  },
  {
    href: "/design-system/components",
    title: "Components",
    desc: "The living inventory — every component, every state, every signal.",
    sample: (
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground type-small">
          Play now
        </span>
        <span className="px-3 py-1.5 rounded-full border border-border type-small">
          Follow
        </span>
      </div>
    ),
  },
];

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
      {/* ── Brand hero — the wordmark card ──────────────────────── */}
      <section className="relative mb-14 rounded-lg border border-border bg-background overflow-hidden">
        <div className="absolute top-5 left-5">
          <PixelCluster />
        </div>
        <div className="absolute bottom-5 right-5">
          <PixelCluster flip />
        </div>
        <div className="py-24 sm:py-32 flex flex-col items-center justify-center text-center px-6">
          <h1 className="font-pixel font-bold text-4xl sm:text-6xl tracking-tight">
            Yuki Rhythm
          </h1>
          <p className="mt-4 type-label text-muted-foreground tracking-[0.25em]">
            STUDIO SYSTEM · 191919 / 1450F0 / 7DF08A / F7F6F3
          </p>
        </div>
      </section>

      {/* ── 01 The chapters ─────────────────────────────────────── */}
      <DsSection index="01" title="The system">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CHAPTERS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-lg border border-border bg-card p-6 hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
            >
              <div className="h-12 flex items-center">{c.sample}</div>
              <div className="flex items-center justify-between mt-4">
                <span className="type-h3">{c.title}</span>
                <span className="type-label text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
                  OPEN →
                </span>
              </div>
              <p className="type-muted mt-1.5">{c.desc}</p>
            </Link>
          ))}
        </div>
      </DsSection>

      {/* ── 02 Iconography ──────────────────────────────────────── */}
      <DsSection index="02" title="Iconography">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-4">
          {ICONS.map((icon) => (
            <div key={icon} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-md bg-card border border-border shadow-e1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/svgs/${icon}.svg`} alt={icon} className="w-5 h-5" />
              </div>
              <div className="type-label text-muted-foreground text-[9px]">
                {icon}
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 03 Textures ─────────────────────────────────────────── */}
      <DsSection index="03" title="Textures">
        <p className="type-p mb-6 max-w-2xl">
          The dithered branding pack — placeholder artwork, backdrops, empty
          states, pixel clusters. Rendered pixelated, never smoothed.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {TEXTURE_NAMES.map((name) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Texture
                name={name}
                className="aspect-square rounded-md border border-border"
              />
              <div className="type-label text-muted-foreground text-[9px] truncate">
                {name}
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 04 Agent ────────────────────────────────────────────── */}
      <DsSection index="04" title="Agent states">
        <p className="type-p mb-6 max-w-2xl">
          The Yuki agent — a dithered canvas companion that reflects app state
          everywhere: searching, downloading, playing, recommending.
        </p>
        <AgentGallery />
      </DsSection>
    </div>
  );
}
