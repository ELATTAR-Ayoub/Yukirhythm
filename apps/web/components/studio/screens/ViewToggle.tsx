"use client";

import { RowsIcon, GridIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import IconSwap from "@/components/studio/IconSwap";

export type TrackView = "rows" | "grid";

interface ViewToggleProps {
  view: TrackView;
  onChange: (view: TrackView) => void;
}

/** Rows ↔ grid switch — one secondary button, IconSwap rolls the icon. */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  const next: TrackView = view === "rows" ? "grid" : "rows";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} view`}
      onClick={() => onChange(next)}
    >
      <IconSwap
        active={view}
        icons={{
          rows: <RowsIcon className="h-4 w-4" />,
          grid: <GridIcon className="h-4 w-4" />,
        }}
        className="h-4 w-4"
      />
    </Button>
  );
}
