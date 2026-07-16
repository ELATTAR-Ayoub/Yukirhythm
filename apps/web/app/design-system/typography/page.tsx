import { DsSection } from "@/components/studio/ds/blocks";

const SCALE: {
  cls: string;
  font: string;
  css: string;
  usage: string;
  sample: string;
}[] = [
  {
    cls: "type-display",
    font: "Satoshi Black 900",
    css: "48–60px · lh 0.95 · tracking -0.025em",
    usage: "Hero moments, the one big line per page",
    sample: "Music becomes weather",
  },
  {
    cls: "type-h1",
    font: "Satoshi Bold 700",
    css: "36px · tracking -0.025em",
    usage: "Page titles",
    sample: "Your Library",
  },
  {
    cls: "type-h2",
    font: "Satoshi Bold 700",
    css: "30px · tracking -0.025em",
    usage: "Section titles (shelves, dashboard blocks)",
    sample: "Recently played",
  },
  {
    cls: "type-h3",
    font: "Satoshi Bold 700",
    css: "24px · tracking -0.025em",
    usage: "Card group titles, dialog titles",
    sample: "Music of the Week",
  },
  {
    cls: "type-h4",
    font: "Satoshi Bold 700",
    css: "20px · tracking -0.025em",
    usage: "Track titles in cards, sub-sections",
    sample: "literal world",
  },
  {
    cls: "type-lead",
    font: "Satoshi Regular 400",
    css: "20px · muted color · lh relaxed",
    usage: "Page intros, one per page max",
    sample: "Everything you like lands here, kept in order of love.",
  },
  {
    cls: "type-p",
    font: "Satoshi Regular 400",
    css: "16px · lh 28px",
    usage: "Body copy, descriptions, settings text",
    sample:
      "Yukirhythm finds and plays music from your searches, learns what you keep, and builds the rest of the week around it.",
  },
  {
    cls: "type-large",
    font: "Satoshi Bold 700",
    css: "18px",
    usage: "Emphasis lines, dialog confirmations",
    sample: "Are you sure you want to delete this playlist?",
  },
  {
    cls: "type-small",
    font: "Satoshi Medium 500",
    css: "14px · lh 1",
    usage: "Buttons, form labels, meta lines",
    sample: "Add to playlist",
  },
  {
    cls: "type-muted",
    font: "Satoshi Regular 400",
    css: "14px · muted color",
    usage: "Hints, timestamps context, captions",
    sample: "Based on your last 30 days of listening.",
  },
  {
    cls: "type-blockquote",
    font: "Satoshi Medium Italic",
    css: "18px · italic · cobalt left border",
    usage: "Quotes, agent commentary",
    sample: "“You played this 14 times on one rainy Tuesday.”",
  },
  {
    cls: "type-label",
    font: "OffBit Bold",
    css: "11px · uppercase · tracking +0.18em",
    usage: "Section labels, catalogue tags, nav groups",
    sample: "01 — LIKED AUDIO",
  },
  {
    cls: "type-pixel-title",
    font: "OffBit Bold",
    css: "24px · tracking -0.025em",
    usage: "Wordmark, pixel moments, empty states",
    sample: "Yuki Rhythm",
  },
  {
    cls: "type-code",
    font: "OffBit Bold",
    css: "14px · muted chip background",
    usage: "Keyboard hints, technical values",
    sample: "Ctrl + K",
  },
  {
    cls: "type-data-sm",
    font: "OffBit Dot",
    css: "12px · tracking +0.025em",
    usage: "Tiny meta: row durations, badge counts",
    sample: "3:59",
  },
  {
    cls: "type-data",
    font: "OffBit Dot",
    css: "1em · tracking +0.025em",
    usage: "Every number: timestamps, BPM, counters",
    sample: "02:07 / 03:59",
  },
  {
    cls: "type-data-md",
    font: "OffBit Dot",
    css: "20px · tracking +0.025em",
    usage: "Player time, stat rows",
    sample: "132 BPM",
  },
  {
    cls: "type-data-lg",
    font: "OffBit Dot",
    css: "30px · tracking +0.025em",
    usage: "Dashboard stats, player time",
    sample: "4,209 PLAYS",
  },
];

export default function TypographyPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="type-h1">Typography</h1>
        <p className="type-lead mt-3 max-w-2xl">
          Two fonts. Hard rule. <b className="text-foreground">Satoshi</b> is
          the voice — everything human reads in it.{" "}
          <b className="text-foreground">OffBit</b> is the machine — labels,
          numbers, and the wordmark. Nothing else gets in.
        </p>
      </div>

      {/* ── 01 The two typefaces ────────────────────────────────── */}
      <DsSection index="01" title="The two typefaces">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-lg border border-border bg-card p-8">
            <div className="type-label text-muted-foreground mb-6">
              SATOSHI — THE VOICE
            </div>
            <div className="font-ui text-7xl font-black leading-none">Aa</div>
            <div className="font-ui text-lg mt-6 leading-relaxed break-all">
              ABCDEFGHIJKLMNOPQRSTUVWXYZ
              <br />
              abcdefghijklmnopqrstuvwxyz
              <br />
              0123456789 !?&amp;%()
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-6">
              <span className="font-ui font-light">Light 300</span>
              <span className="font-ui font-normal">Regular 400</span>
              <span className="font-ui font-medium">Medium 500</span>
              <span className="font-ui font-bold">Bold 700</span>
              <span className="font-ui font-black">Black 900</span>
              <span className="font-ui italic">Italic</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-ink text-paper p-8">
            <div className="type-label text-mint mb-6">
              OFFBIT — THE MACHINE
            </div>
            <div className="font-pixel text-7xl leading-none">Aa</div>
            <div className="font-pixel text-lg mt-6 leading-relaxed break-all">
              ABCDEFGHIJKLMNOPQRSTUVWXYZ
              <br />
              abcdefghijklmnopqrstuvwxyz
              <br />
              0123456789 !?&amp;%()
            </div>
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mt-6">
              <span className="font-pixel">Regular</span>
              <span className="font-pixel font-bold">Bold</span>
              <span className="font-data">Dot 0123456789</span>
              <span className="font-data font-bold">Dot Bold 0123</span>
            </div>
          </div>
        </div>
      </DsSection>

      {/* ── 02 The type scale ───────────────────────────────────── */}
      <DsSection index="02" title="The type scale">
        <p className="type-muted mb-8 max-w-xl">
          Every style is a named CSS class — use the class, never hand-rolled
          sizes. Left: the class and its recipe. Right: the style, live.
        </p>
        <div>
          {SCALE.map((row) => (
            <div
              key={row.cls}
              className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 md:gap-8 py-6 border-b border-border last:border-b-0"
            >
              <div>
                <div className="type-code inline-block">.{row.cls}</div>
                <div className="type-label text-muted-foreground mt-2.5">
                  {row.font}
                </div>
                <div className="type-muted mt-1">{row.css}</div>
                <div className="type-muted mt-1 text-[12px] opacity-80">
                  {row.usage}
                </div>
              </div>
              <div className="min-w-0 flex items-center">
                <div className={row.cls}>{row.sample}</div>
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* ── 03 Specimen — everything together ───────────────────── */}
      <DsSection index="03" title="Specimen">
        <div className="rounded-lg border border-border bg-card p-8 md:p-12 max-w-3xl">
          <div className="type-label text-primary">
            YUKI JOURNAL — ISSUE 01
          </div>
          <h1 className="type-h1 mt-3">The Winter Archive</h1>
          <p className="type-lead mt-4">
            How a music player learns what you love — and why the songs you
            keep say more than the songs you skip.
          </p>
          <p className="type-p mt-6">
            Every library starts as noise. A track from a friend, an opening
            from a show you watched twice, something the algorithm guessed at
            2 a.m. Yukirhythm treats each one as a signal — kept, replayed,
            abandoned — and slowly the noise becomes a portrait.
          </p>
          <h2 className="type-h2 mt-10 pb-2 border-b border-border">
            What the player hears
          </h2>
          <p className="type-p mt-6">
            The player watches the quiet things: the skip inside ten seconds,
            the replay at midnight, the playlist you built and never named.
            Press <span className="type-code">Ctrl + K</span> anywhere to ask
            the agent what it thinks it knows.
          </p>
          <blockquote className="type-blockquote mt-6">
            You played this 14 times on one rainy Tuesday. I filed it under
            weather, not music.
          </blockquote>
          <h3 className="type-h3 mt-10">This week&apos;s portrait</h3>
          <ul className="mt-6 ml-6 list-disc [&>li]:mt-2">
            <li className="type-p">
              literal world —{" "}
              <span className="type-label text-muted-foreground">
                KISIDAKYOUDAN
              </span>{" "}
              <span className="type-data text-primary">14 PLAYS</span>
            </li>
            <li className="type-p">
              夜盲症 —{" "}
              <span className="type-label text-muted-foreground">
                蔡健雅 TANYA CHUA
              </span>{" "}
              <span className="type-data text-primary">9 PLAYS</span>
            </li>
            <li className="type-p">
              Nightglow —{" "}
              <span className="type-label text-muted-foreground">
                TANYA CHUA
              </span>{" "}
              <span className="type-data text-primary">7 PLAYS</span>
            </li>
          </ul>
          <div className="flex items-baseline justify-between mt-10 pt-6 border-t border-border">
            <span className="type-muted">Listening time this week</span>
            <span className="type-data-lg text-primary">11:42:07</span>
          </div>
          <p className="type-small mt-8 text-muted-foreground">
            Continue reading in your dashboard
          </p>
        </div>
      </DsSection>

      {/* ── 04 CJK fallback ─────────────────────────────────────── */}
      <DsSection index="04" title="CJK fallback">
        <p className="type-p max-w-2xl">
          Satoshi carries no Chinese or Japanese glyphs — it is a Latin
          typeface. Per the hard rule, no third display font: CJK characters
          fall through the stack to <b>Noto Sans JP</b>, invisibly, mid-line.
          Latin stays Satoshi, ideographs render Noto. If it ever looks wrong
          below, the stack is broken.
        </p>
        <div className="rounded-lg border border-border bg-card p-8 mt-6 grid gap-5">
          <div className="type-h2">
            岸田教団&amp;THE明星ロケッツ — literal world
          </div>
          <div className="type-h3">蔡健雅 Tanya Chua — 夜盲症 (Nightglow)</div>
          <div className="type-p">
            雪のリズム — the rhythm of snow. Mixed scripts share one line:
            サビで泣いた, 副歌很好听, and Satoshi keeps the Latin crisp.
          </div>
          <div className="type-label text-muted-foreground">
            ラベルもテスト — LABELS FALL BACK TOO — 中文也可以
          </div>
        </div>
      </DsSection>
    </div>
  );
}
