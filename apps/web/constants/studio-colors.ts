// Studio color system:
//   · ink — the base scale (snow #F7F6F3 at 50 → ink #191919 at 950)
//   · cobalt — action color, 3 shades (soft / default / deep)
//   · mint — life color, 3 shades (soft / default / deep)
//   · destructive — one red, warnings and deletes ONLY

export interface RampStep {
  step: number;
  hsl: string;
}

/** The base scale. Every surface, border and text tone lives here. */
export const INK_RAMP: RampStep[] = [
  { step: 50, hsl: "hsl(45 20% 96%)" }, // = snow #F7F6F3
  { step: 100, hsl: "hsl(45 14% 91%)" },
  { step: 200, hsl: "hsl(45 10% 84%)" },
  { step: 300, hsl: "hsl(45 8% 74%)" },
  { step: 400, hsl: "hsl(45 5% 60%)" },
  { step: 500, hsl: "hsl(45 3% 46%)" },
  { step: 600, hsl: "hsl(45 2% 36%)" },
  { step: 700, hsl: "hsl(0 0% 28%)" },
  { step: 800, hsl: "hsl(0 0% 20%)" },
  { step: 900, hsl: "hsl(0 0% 14%)" },
  { step: 950, hsl: "hsl(0 0% 10%)" }, // = ink #191919
];

export interface Shade {
  name: string;
  tw: string;
  hsl: string;
  hex: string;
  use: string;
  textClass: string;
}

/** Cobalt — the action color. */
export const COBALT_SHADES: Shade[] = [
  {
    name: "Soft",
    tw: "cobalt-soft",
    hsl: "hsl(224 96% 93%)",
    hex: "#DCE5FD",
    use: "washes, selected rows, focus halos",
    textClass: "text-ink",
  },
  {
    name: "Cobalt",
    tw: "cobalt",
    hsl: "hsl(224 88% 51%)",
    hex: "#1450F0",
    use: "buttons, links, active nav — THE action color",
    textClass: "text-snow",
  },
  {
    name: "Deep",
    tw: "cobalt-deep",
    hsl: "hsl(227 78% 34%)",
    hex: "#132A9A",
    use: "pressed states, dark-mode surfaces",
    textClass: "text-snow",
  },
];

/** Mint — the life color. */
export const MINT_SHADES: Shade[] = [
  {
    name: "Soft",
    tw: "mint-soft",
    hsl: "hsl(127 68% 90%)",
    hex: "#D4F7DA",
    use: "success washes, playing-row background",
    textClass: "text-ink",
  },
  {
    name: "Mint",
    tw: "mint",
    hsl: "hsl(127 79% 72%)",
    hex: "#7DF08A",
    use: "EQ bars, now-playing marks, positive stats",
    textClass: "text-ink",
  },
  {
    name: "Deep",
    tw: "mint-deep",
    hsl: "hsl(129 52% 35%)",
    hex: "#2B883D",
    use: "success text on light surfaces",
    textClass: "text-snow",
  },
];

/** Semantic tokens → what they resolve to, per theme. */
export const SEMANTIC_MAP: {
  token: string;
  usage: string;
  light: string;
  dark: string;
}[] = [
  {
    token: "background",
    usage: "page surface",
    light: "hsl(45 20% 96%)",
    dark: "hsl(0 0% 10%)",
  },
  {
    token: "foreground",
    usage: "text",
    light: "hsl(0 0% 10%)",
    dark: "hsl(45 20% 96%)",
  },
  {
    token: "card",
    usage: "raised surfaces",
    light: "hsl(40 20% 98%)",
    dark: "hsl(0 0% 13%)",
  },
  {
    token: "secondary",
    usage: "quiet fills, hovers",
    light: "hsl(45 8% 89%)",
    dark: "hsl(0 0% 16%)",
  },
  {
    token: "muted-foreground",
    usage: "hints, captions",
    light: "hsl(0 0% 38%)",
    dark: "hsl(0 0% 62%)",
  },
  {
    token: "border",
    usage: "hairlines, inputs",
    light: "hsl(45 6% 84%)",
    dark: "hsl(0 0% 19%)",
  },
  {
    token: "primary",
    usage: "actions, links, focus",
    light: "hsl(224 88% 51%)",
    dark: "hsl(224 88% 58%)",
  },
  {
    token: "accent",
    usage: "success, now playing",
    light: "hsl(127 79% 72%)",
    dark: "hsl(127 79% 72%)",
  },
  {
    token: "destructive",
    usage: "delete, errors — only",
    light: "hsl(0 84% 60%)",
    dark: "hsl(0 72% 51%)",
  },
];
