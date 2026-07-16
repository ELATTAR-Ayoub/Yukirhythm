"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface BadgeSwitcherProps {
  options: string[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  /** Signal: badge_switch */
}

/** Filter chips row (All · Music · Podcasts …) that scopes a whole page. */
export default function BadgeSwitcher({
  options,
  defaultValue,
  onChange,
  className,
}: BadgeSwitcherProps) {
  const [active, setActive] = useState(defaultValue ?? options[0]);

  return (
    <div
      className={cn("flex items-center gap-2 flex-wrap", className)}
      role="tablist"
      data-signal="badge_switch"
    >
      {options.map((option) => {
        const isActive = option === active;
        return (
          <button
            key={option}
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              setActive(option);
              onChange?.(option);
            }}
            className={cn(
              "px-4 py-1.5 rounded-full font-ui text-sm font-medium border transition-all duration-fast",
              "active:scale-95",
              isActive
                ? "bg-ink text-snow border-ink dark:bg-snow dark:text-ink dark:border-snow shadow-e1"
                : "bg-card text-foreground border-border hover:border-ink/40 dark:hover:border-snow/40"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
