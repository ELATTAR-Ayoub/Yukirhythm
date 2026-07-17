"use client";

import { cn } from "@/lib/utils";

interface IconSwapProps {
  /** Key of the icon currently shown */
  active: string;
  icons: Record<string, React.ReactNode>;
  className?: string;
}

/**
 * RULE — every control that alternates between icons (play/pause, mute/unmute,
 * like/unlike, expand/collapse…) swaps them through IconSwap. No exceptions.
 *
 * Vertical carousel: the leaving icon rolls up and out of the button; the
 * entering icon then drops down from above into the center.
 */
export default function IconSwap({ active, icons, className }: IconSwapProps) {
  return (
    <span
      className={cn(
        "relative inline-grid place-items-center overflow-hidden",
        className
      )}
    >
      {Object.entries(icons).map(([key, node]) => {
        const isActive = key === active;
        return (
          <span
            key={key}
            aria-hidden={!isActive}
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center justify-center transition-all ease-spring duration-base",
              isActive
                ? "translate-y-0 opacity-100 delay-100" // …then the new one comes down
                : "-translate-y-[160%] opacity-0 delay-0" // the old one goes up first
            )}
          >
            {node}
          </span>
        );
      })}
    </span>
  );
}
