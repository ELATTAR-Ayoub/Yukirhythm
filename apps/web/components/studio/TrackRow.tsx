import { PlayIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import Artwork from "@/components/studio/Artwork";
import { type TextureName } from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import EqIndicator from "@/components/studio/EqIndicator";
import { PlayerButton } from "@/components/studio/PlayerButton";

interface TrackRowProps {
  index?: number;
  title: string;
  artist?: string;
  duration?: string;
  texture?: TextureName;
  artUrl?: string;
  playing?: boolean;
  selected?: boolean;
  /**
   * The hover overlay renders a real <button aria-label="Play">. Callers that
   * wrap the row in their own interactive element (a role="button" div, an
   * anchor) must opt out — a button nested inside interactive content is
   * invalid HTML and leaves a dead, near-unlabelled keyboard stop on every
   * row. Mirrors MediaCard's `playable` prop.
   */
  playable?: boolean;
  /**
   * Adds an album column for wide layouts (hidden below `lg`). There is no
   * per-track album field in MockTrack, so callers pass the containing
   * collection's title — never a fabricated per-track value.
   */
  desktop?: boolean;
  album?: string;
  className?: string;
  /** Signal: row_play, row_queue */
}

/** List row for library, queue and history views. */
export default function TrackRow({
  index,
  title,
  artist,
  duration,
  texture,
  artUrl,
  playing = false,
  selected = false,
  playable = true,
  desktop = false,
  album,
  className,
}: TrackRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer",
        "hover:bg-secondary transition-colors duration-fast",
        selected && "bg-secondary",
        className
      )}
      data-signal="row_play"
    >
      <div className="relative w-9 h-9 rounded-sm overflow-hidden shrink-0">
        <Artwork
          src={artUrl}
          texture={texture ?? "tx-k-silk"}
          alt=""
          className="absolute inset-0 w-full h-full"
        />
        {/* eq / hover play sit over the artwork now that the index lives inline */}
        {playing ? (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40 group-hover:opacity-0 transition-opacity duration-fast">
            <EqIndicator />
          </span>
        ) : null}
        {playable ? (
          // The row's own role="button" wrapper (supplied by every consumer
          // that isn't already interactive) is the accessible control — this
          // overlay is hover-reveal decoration, so aria-hidden pulls it out
          // of the a11y tree. Only valid because PlayerButton is
          // tabIndex={-1} below: aria-hidden over a still-focusable element
          // would trap keyboard focus on an invisible node.
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
          >
            <PlayerButton
              variant="ghost"
              size="sm"
              tabIndex={-1}
              aria-label="Play"
              data-signal="row_play"
              className="text-snow"
            >
              <PlayIcon />
            </PlayerButton>
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "font-ui font-medium text-sm truncate",
            playing && "text-primary"
          )}
        >
          {title}
        </div>
        {index != null || artist ? (
          <div className="flex items-center gap-1.5 min-w-0">
            {index != null ? (
              <DataText className="text-[10px] text-muted-foreground shrink-0">
                {String(index).padStart(2, "0")}
              </DataText>
            ) : null}
            {index != null && artist ? (
              <span className="text-muted-foreground text-[10px] shrink-0">
                ·
              </span>
            ) : null}
            {artist ? (
              <span className="font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                {artist}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {desktop && album ? (
        <div className="hidden lg:block min-w-0 flex-1">
          <span className="font-ui text-sm text-muted-foreground truncate block">
            {album}
          </span>
        </div>
      ) : null}
      {duration ? (
        <DataText className="text-sm text-muted-foreground shrink-0">
          {duration}
        </DataText>
      ) : null}
    </div>
  );
}
