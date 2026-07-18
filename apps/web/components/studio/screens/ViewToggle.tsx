"use client";

import { RowsIcon, GridIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type TrackView = "rows" | "grid";

interface ViewToggleProps {
  view: TrackView;
  onChange: (view: TrackView) => void;
}

/** Rows ↔ grid switch — one secondary button, both icons, active one lit. */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  const next: TrackView = view === "rows" ? "grid" : "rows";
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`Switch to ${next} view`}
      onClick={() => onChange(next)}
      className="gap-2"
    >
      <RowsIcon
        className={cn(
          "h-3.5 w-3.5 transition-colors duration-fast",
          view === "rows" ? "text-primary" : "text-muted-foreground"
        )}
      />
      <GridIcon
        className={cn(
          "h-3.5 w-3.5 transition-colors duration-fast",
          view === "grid" ? "text-primary" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
