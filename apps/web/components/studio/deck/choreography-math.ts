const TAU = Math.PI * 2;

export type SwapDirection = "next" | "prev";

/** Wrap-around track index after a swap. */
export function nextIndex(
  current: number,
  dir: SwapDirection,
  n: number
): number {
  return (current + (dir === "next" ? 1 : -1) + n) % n;
}

/**
 * Rotation target that seats an incoming disc: from wherever its face
 * currently points, turn at least one extra full revolution and land
 * label-upright (a multiple of a full turn).
 */
export function seatRotation(currentRotation: number): number {
  return Math.ceil(currentRotation / TAU) * TAU + TAU;
}
