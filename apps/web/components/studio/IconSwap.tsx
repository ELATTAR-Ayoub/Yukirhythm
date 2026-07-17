"use client";

import { cn } from "@/lib/utils";

interface IconSwapProps {
  /** Key of the icon currently shown */
  active: string;
  /** Icons in their strip order — first key sits at the top of the wheel */
  icons: Record<string, React.ReactNode>;
  className?: string;
}

/**
 * RULE — every control that alternates between icons (play/pause, mute/unmute,
 * like/unlike, expand/collapse…) swaps them through IconSwap. No exceptions.
 *
 * A true vertical carousel: icons form a strip in their given order. Each icon
 * holds its position at (index − activeIndex) steps from center, so advancing
 * rolls the strip UP (old exits top, next rises from below) and going back
 * rolls it DOWN (old exits bottom, previous descends from above).
 */
export default function IconSwap({ active, icons, className }: IconSwapProps) {
  const keys = Object.keys(icons);
  const activeIdx = Math.max(0, keys.indexOf(active));

  return (
    <span
      className={cn(
        "relative inline-grid place-items-center overflow-hidden",
        className
      )}
    >
      {keys.map((key, i) => {
        const offset = i - activeIdx; // strip position relative to center
        return (
          <span
            key={key}
            aria-hidden={offset !== 0}
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center justify-center transition-all ease-spring duration-base",
              offset === 0 ? "opacity-100" : "opacity-0"
            )}
            style={{ transform: `translateY(${offset * 160}%)` }}
          >
            {icons[key]}
          </span>
        );
      })}
    </span>
  );
}
