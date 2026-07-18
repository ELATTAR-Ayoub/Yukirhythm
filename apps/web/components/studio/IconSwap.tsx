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
 * RULE — every control that alternates between icons (play/pause/wait, mute,
 * like, expand…) swaps them through IconSwap. No exceptions.
 *
 * A true vertical carousel: icons form a strip in their given order. Each icon
 * holds its position at (index − activeIndex) steps from center, so advancing
 * rolls the strip UP (old exits top, next rises from below) and going back
 * rolls it DOWN. The arriving icon lands with the tabs-pill jelly squash.
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
        const isActive = offset === 0;
        return (
          <span
            key={key}
            aria-hidden={!isActive}
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center justify-center transition-all ease-spring duration-slow",
              isActive ? "opacity-100" : "opacity-0"
            )}
            style={{ transform: `translateY(${offset * 160}%)` }}
          >
            {/* remounts on arrival so the jelly squash replays every time */}
            <span
              key={isActive ? `landed-${activeIdx}` : "waiting"}
              className={cn("inline-flex", isActive && "anim-jelly")}
              style={isActive ? { animationDelay: "140ms" } : undefined}
            >
              {icons[key]}
            </span>
          </span>
        );
      })}
    </span>
  );
}
