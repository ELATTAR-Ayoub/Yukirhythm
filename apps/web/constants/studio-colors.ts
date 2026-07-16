// Studio color system — deliberately small:
//   · ONE scale: ink (paper #F7F6F3 at 50 → ink #191919 at 950) — the base of the app
//   · TWO accents: cobalt #1450F0 (action) and mint #7DF08A (life) — single values, no shades
//   · ONE red: destructive — single value, errors and deletes only

export interface RampStep {
  step: number;
  hsl: string;
}

/** The base scale. Every surface, border and text tone lives here. */
export const INK_RAMP: RampStep[] = [
  { step: 50, hsl: "hsl(45 20% 96%)" }, // = paper #F7F6F3
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

/** The three non-neutral colors. Single values — no scales. */
export const ROLE_COLORS = [
  {
    name: "Cobalt",
    hex: "#1450F0",
    hsl: "hsl(224 88% 51%)",
    darkNote: "dark mode lifts to hsl(224 88% 58%)",
    role: "Action",
    do: ["primary buttons", "links", "focus rings", "active nav"],
    dont: ["backgrounds", "long text", "decorations"],
    chipClass: "bg-cobalt text-paper",
  },
  {
    name: "Mint",
    hex: "#7DF08A",
    hsl: "hsl(127 79% 72%)",
    darkNote: "same value in both themes",
    role: "Life",
    do: ["now playing", "success", "positive stats", "EQ bars"],
    dont: ["buttons", "text on paper", "warnings"],
    chipClass: "bg-mint text-ink",
  },
  {
    name: "Destructive",
    hex: "#EF4444",
    hsl: "hsl(0 84% 60%)",
    darkNote: "dark mode deepens to hsl(0 72% 51%)",
    role: "Danger",
    do: ["delete actions", "errors", "irreversible warnings"],
    dont: ["emphasis", "badges for fun", "anything not dangerous"],
    chipClass: "bg-destructive text-paper",
  },
] as const;

/** Semantic tokens → what they resolve to, per theme. */
export const SEMANTIC_MAP: {
  token: string;
  usage: string;
  light: string;
  dark: string;
}[] = [
  { token: "background", usage: "page surface", light: "hsl(45 20% 96%)", dark: "hsl(0 0% 10%)" },
  { token: "foreground", usage: "text", light: "hsl(0 0% 10%)", dark: "hsl(45 20% 96%)" },
  { token: "card", usage: "raised surfaces", light: "hsl(40 20% 98%)", dark: "hsl(0 0% 13%)" },
  { token: "secondary", usage: "quiet fills, hovers", light: "hsl(45 8% 89%)", dark: "hsl(0 0% 16%)" },
  { token: "muted-foreground", usage: "hints, captions", light: "hsl(0 0% 38%)", dark: "hsl(0 0% 62%)" },
  { token: "border", usage: "hairlines, inputs", light: "hsl(45 6% 84%)", dark: "hsl(0 0% 19%)" },
  { token: "primary", usage: "actions, links, focus", light: "hsl(224 88% 51%)", dark: "hsl(224 88% 58%)" },
  { token: "accent", usage: "success, now playing", light: "hsl(127 79% 72%)", dark: "hsl(127 79% 72%)" },
  { token: "destructive", usage: "delete, errors", light: "hsl(0 84% 60%)", dark: "hsl(0 72% 51%)" },
];
