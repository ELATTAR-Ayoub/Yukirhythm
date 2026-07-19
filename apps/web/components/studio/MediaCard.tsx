import { PauseIcon, PlayIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import Texture, { TextureName } from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import EqIndicator from "@/components/studio/EqIndicator";
import { PlayerButton } from "@/components/studio/PlayerButton";

export type MediaCardSize = "sm" | "md" | "lg";
export type MediaCardVariant = "boxy" | "extended";

interface MediaCardProps {
  title: string;
  artist?: string;
  /** Dithered placeholder texture used when no artwork URL exists */
  texture?: TextureName;
  artUrl?: string;
  duration?: string;
  size?: MediaCardSize;
  variant?: MediaCardVariant;
  playing?: boolean;
  /**
   * The hover play overlay renders a real <button>. Callers that wrap the card
   * in their own interactive element (an anchor, a row button) must opt out —
   * a button nested inside interactive content is invalid HTML and leaves a
   * dead keyboard stop on every card.
   */
  playable?: boolean;
  className?: string;
  /** Emitted signal (documented; wiring comes with the data layer): card_play, card_open */
}

const BOXY_WIDTHS: Record<MediaCardSize, string> = {
  sm: "w-36",
  md: "w-48",
  lg: "w-64",
};

const TITLE_SIZES: Record<MediaCardSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

function Artwork({
  texture,
  artUrl,
  title,
  className,
}: {
  texture?: TextureName;
  artUrl?: string;
  title: string;
  className?: string;
}) {
  if (artUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={artUrl} alt={title} className={cn("object-cover", className)} />
    );
  }
  return <Texture name={texture ?? "tx-k-marble"} className={className} />;
}

function PlayOverlay({ playing }: { playing: boolean }) {
  return (
    <span
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0",
        "group-hover:opacity-100 group-hover:bg-ink/30 transition-all duration-base"
      )}
    >
      {/* composed from OUR PlayerButton — never a hand-rolled circle */}
      <span className="translate-y-1 group-hover:translate-y-0 transition-transform duration-base">
        <PlayerButton
          variant="primary"
          size="lg"
          aria-label={playing ? "Pause" : "Play"}
          data-signal="card_play"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </PlayerButton>
      </span>
    </span>
  );
}

/**
 * The workhorse content card — tracks, albums, playlists, podcasts.
 * 6 shapes: sm/md/lg × boxy/extended.
 */
export default function MediaCard({
  title,
  artist,
  texture,
  artUrl,
  duration,
  size = "md",
  variant = "boxy",
  playing = false,
  playable = true,
  className,
}: MediaCardProps) {
  if (variant === "extended") {
    return (
      <div
        className={cn(
          "group relative w-full flex items-center gap-4 p-3 rounded-lg bg-card border border-border shadow-e1",
          "hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base cursor-pointer",
          className
        )}
        data-signal="card_play"
      >
        <div
          className={cn(
            "relative shrink-0 rounded-md overflow-hidden",
            size === "sm" ? "w-12 h-12" : size === "md" ? "w-16 h-16" : "w-24 h-24"
          )}
        >
          <Artwork
            texture={texture}
            artUrl={artUrl}
            title={title}
            className="absolute inset-0 w-full h-full"
          />
          {playable ? <PlayOverlay playing={playing} /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-display font-medium truncate",
              TITLE_SIZES[size],
              playing && "text-primary"
            )}
          >
            {title}
          </div>
          {artist ? (
            <div className="font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate mt-0.5">
              {artist}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3 pr-1 shrink-0">
          {playing ? <EqIndicator /> : null}
          {duration ? (
            <DataText className="text-sm text-muted-foreground">
              {duration}
            </DataText>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative shrink-0 rounded-lg bg-card border border-border shadow-e1 p-2.5",
        "hover:shadow-e3 hover:-translate-y-1 transition-all duration-base cursor-pointer",
        BOXY_WIDTHS[size],
        className
      )}
      data-signal="card_play"
    >
      <div className="relative aspect-square rounded-md overflow-hidden">
        <Artwork
          texture={texture}
          artUrl={artUrl}
          title={title}
          className="absolute inset-0 w-full h-full"
        />
        {playable ? <PlayOverlay playing={playing} /> : null}
        {playing ? (
          <span className="absolute bottom-2 right-2 bg-ink/70 rounded-sm px-1.5 py-1">
            <EqIndicator />
          </span>
        ) : null}
      </div>
      <div className="pt-2.5 px-0.5">
        <div
          className={cn(
            "font-display font-medium truncate",
            TITLE_SIZES[size],
            playing && "text-primary"
          )}
        >
          {title}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {artist ? (
            <div className="font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
              {artist}
            </div>
          ) : null}
          {duration ? (
            <DataText className="text-xs text-muted-foreground shrink-0">
              {duration}
            </DataText>
          ) : null}
        </div>
      </div>
    </div>
  );
}
