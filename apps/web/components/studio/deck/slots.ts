export type Slot = "center" | "left" | "right" | "hidden";

export interface SlotTransform {
  pos: [number, number, number];
  rotY: number;
  scale: number;
}

// Frontal composition from the owner's sketch: the center disc faces the
// viewer on the platter, neighbours hover tilted at the sides.
export const SLOTS: Record<Slot, SlotTransform> = {
  center: { pos: [0, 0, 0], rotY: 0, scale: 1 },
  left: { pos: [-3.05, 0, -0.9], rotY: 1.05, scale: 0.86 },
  right: { pos: [3.05, 0, -0.9], rotY: -1.05, scale: 0.86 },
  hidden: { pos: [0, -0.6, -4.2], rotY: 0, scale: 0.15 },
};

/** Which slot disc `i` occupies when track `current` is on the platter. */
export function slotFor(i: number, current: number, n: number): Slot {
  if (n <= 0) return "hidden";
  const o = (((i - current) % n) + n) % n;
  if (o === 0) return "center";
  if (o === 1) return "right";
  if (o === n - 1 && n > 2) return "left";
  return "hidden";
}
