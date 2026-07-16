// Studio color ramps — full 50→950 scales grown from the four brand anchors:
//   Ink #191919 (= ink-950) · Paper #F7F6F3 (= ink-50)
//   Cobalt #1450F0 (= cobalt-600) · Mint #7DF08A (= mint-400)
// Values are HSL. These are the ONLY hues allowed in the app.

export interface RampStep {
  step: number;
  hsl: string;
}

export interface Ramp {
  name: string;
  description: string;
  anchor?: { step: number; label: string };
  steps: RampStep[];
}

export const RAMPS: Ramp[] = [
  {
    name: "ink",
    description:
      "The warm neutral spine. Paper lives at 50, Ink at 950 — every surface, border and text tone sits on this ramp.",
    anchor: { step: 950, label: "#191919 · brand ink (50 = paper #F7F6F3)" },
    steps: [
      { step: 50, hsl: "hsl(45 20% 96%)" },
      { step: 100, hsl: "hsl(45 14% 91%)" },
      { step: 200, hsl: "hsl(45 10% 84%)" },
      { step: 300, hsl: "hsl(45 8% 74%)" },
      { step: 400, hsl: "hsl(45 5% 60%)" },
      { step: 500, hsl: "hsl(45 3% 46%)" },
      { step: 600, hsl: "hsl(45 2% 36%)" },
      { step: 700, hsl: "hsl(0 0% 28%)" },
      { step: 800, hsl: "hsl(0 0% 20%)" },
      { step: 900, hsl: "hsl(0 0% 14%)" },
      { step: 950, hsl: "hsl(0 0% 10%)" },
    ],
  },
  {
    name: "cobalt",
    description:
      "The action hue — buttons, links, focus, active states. Brand cobalt sits at 600.",
    anchor: { step: 600, label: "#1450F0 · brand cobalt" },
    steps: [
      { step: 50, hsl: "hsl(224 100% 97%)" },
      { step: 100, hsl: "hsl(224 96% 93%)" },
      { step: 200, hsl: "hsl(224 93% 87%)" },
      { step: 300, hsl: "hsl(224 91% 78%)" },
      { step: 400, hsl: "hsl(224 89% 66%)" },
      { step: 500, hsl: "hsl(224 88% 57%)" },
      { step: 600, hsl: "hsl(224 88% 51%)" },
      { step: 700, hsl: "hsl(226 84% 42%)" },
      { step: 800, hsl: "hsl(227 78% 34%)" },
      { step: 900, hsl: "hsl(228 72% 27%)" },
      { step: 950, hsl: "hsl(230 68% 17%)" },
    ],
  },
  {
    name: "mint",
    description:
      "The life hue — success, now-playing, growth. Brand mint sits at 400.",
    anchor: { step: 400, label: "#7DF08A · brand mint" },
    steps: [
      { step: 50, hsl: "hsl(127 65% 96%)" },
      { step: 100, hsl: "hsl(127 68% 90%)" },
      { step: 200, hsl: "hsl(127 72% 83%)" },
      { step: 300, hsl: "hsl(127 76% 78%)" },
      { step: 400, hsl: "hsl(127 79% 72%)" },
      { step: 500, hsl: "hsl(127 62% 56%)" },
      { step: 600, hsl: "hsl(128 56% 44%)" },
      { step: 700, hsl: "hsl(129 52% 35%)" },
      { step: 800, hsl: "hsl(130 47% 28%)" },
      { step: 900, hsl: "hsl(131 44% 22%)" },
      { step: 950, hsl: "hsl(133 45% 12%)" },
    ],
  },
  {
    name: "signal",
    description:
      "Destructive and error only — deletes, failures, warnings that must sting.",
    anchor: { step: 500, label: "destructive token" },
    steps: [
      { step: 50, hsl: "hsl(0 86% 97%)" },
      { step: 100, hsl: "hsl(0 90% 94%)" },
      { step: 200, hsl: "hsl(0 92% 88%)" },
      { step: 300, hsl: "hsl(0 90% 80%)" },
      { step: 400, hsl: "hsl(0 87% 70%)" },
      { step: 500, hsl: "hsl(0 84% 60%)" },
      { step: 600, hsl: "hsl(0 76% 50%)" },
      { step: 700, hsl: "hsl(0 74% 41%)" },
      { step: 800, hsl: "hsl(0 70% 34%)" },
      { step: 900, hsl: "hsl(0 64% 28%)" },
      { step: 950, hsl: "hsl(0 72% 15%)" },
    ],
  },
];

/** Semantic tokens → ramp positions (light / dark). */
export const SEMANTIC_MAP: { token: string; light: string; dark: string; usage: string }[] = [
  { token: "background", light: "ink-50", dark: "ink-950", usage: "page surface" },
  { token: "foreground", light: "ink-950", dark: "ink-50", usage: "text" },
  { token: "card", light: "white-warm", dark: "ink-900", usage: "raised surfaces" },
  { token: "primary", light: "cobalt-600", dark: "cobalt-500", usage: "actions, links, focus" },
  { token: "accent", light: "mint-400", dark: "mint-400", usage: "success, now playing" },
  { token: "secondary / muted", light: "ink-100", dark: "ink-800", usage: "quiet fills, dividers" },
  { token: "muted-foreground", light: "ink-600", dark: "ink-400", usage: "hints, captions" },
  { token: "border / input", light: "ink-200", dark: "ink-800", usage: "hairlines, fields" },
  { token: "destructive", light: "signal-500", dark: "signal-600", usage: "delete, errors" },
  { token: "ring", light: "cobalt-600", dark: "cobalt-500", usage: "focus outline" },
];
