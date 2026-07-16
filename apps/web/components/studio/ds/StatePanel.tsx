"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StatePanelProps {
  name: string;
  signal?: string;
  /** Map of state name → rendered view. First key is the default. */
  views: Record<string, React.ReactNode>;
  className?: string;
}

/**
 * Component showcase panel — name top-left, state switcher top-right.
 * Click a state chip to see the component in that state.
 */
export default function StatePanel({
  name,
  signal,
  views,
  className,
}: StatePanelProps) {
  const states = Object.keys(views);
  const [active, setActive] = useState(states[0]);

  return (
    <div className={cn("mb-10 last:mb-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <div className="flex items-baseline gap-4">
          <h3 className="font-display font-semibold text-lg">{name}</h3>
          {signal ? (
            <span className="font-label text-[10px] uppercase tracking-wider text-primary hidden sm:inline">
              signal: {signal}
            </span>
          ) : null}
        </div>
        {states.length > 1 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {states.map((state) => (
              <button
                key={state}
                onClick={() => setActive(state)}
                className={cn(
                  "px-2.5 py-1 rounded-full font-label text-[10px] uppercase tracking-wider border transition-all duration-fast active:scale-95",
                  state === active
                    ? "bg-ink text-paper border-ink dark:bg-paper dark:text-ink dark:border-paper"
                    : "bg-transparent text-muted-foreground border-border hover:border-ink/40 dark:hover:border-paper/40"
                )}
              >
                {state}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="rounded-lg border border-border bg-background p-5 overflow-x-auto">
        {views[active]}
      </div>
    </div>
  );
}
