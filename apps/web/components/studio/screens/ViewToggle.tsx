"use client";

import { RowsIcon, GridIcon } from "@radix-ui/react-icons";

import { PlayerButton } from "@/components/studio/PlayerButton";

export type TrackView = "rows" | "grid";

interface ViewToggleProps {
  view: TrackView;
  onChange: (view: TrackView) => void;
}

/** Rows ↔ grid switch for playlist track lists. */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <PlayerButton
        variant={view === "rows" ? "primary" : "ghost"}
        size="sm"
        aria-label="Rows view"
        onClick={() => onChange("rows")}
      >
        <RowsIcon />
      </PlayerButton>
      <PlayerButton
        variant={view === "grid" ? "primary" : "ghost"}
        size="sm"
        aria-label="Grid view"
        onClick={() => onChange("grid")}
      >
        <GridIcon />
      </PlayerButton>
    </div>
  );
}
