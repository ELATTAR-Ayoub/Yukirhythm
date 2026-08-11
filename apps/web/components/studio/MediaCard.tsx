"use client";

import { useEffect, useRef } from "react";
import { PauseIcon, PlayIcon, PlusIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import Artwork from "@/components/studio/Artwork";
import { TextureName } from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import EqIndicator from "@/components/studio/EqIndicator";
import { PlayerButton } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";

export type MediaCardSize = "sm" | "md" | "lg";
export type MediaCardVariant = "boxy" | "extended";

interface MediaCardProps {
  title: string;
  artist?: string;
  /** Dithered placeholder texture used when no artwork URL exists */
  texture?: TextureName;
  artUrl?: string;
  /** A fully-built artwork node (e.g. `<CollectionArt>`'s mosaic) that
   *  replaces the texture/artUrl swatch entirely when supplied — the card
   *  still owns the sizing/rounding box around it. */
  art?: React.ReactNode;
  duration?: string;
  size?: MediaCardSize;
  variant?: MediaCardVariant;
  playing?: boolean;
  /** Seconds left in the active ten-second audition. */
  previewSecondsRemaining?: number;
  /**
   * The hover play overlay renders a real <button>. Callers that wrap the card
   * in their own interactive element (an anchor, a row button) must opt out —
   * a button nested inside interactive content is invalid HTML and leaves a
   * dead keyboard stop on every card.
   */
  playable?: boolean;
  className?: string;
  /** Card-body action. Delayed briefly so a double click never previews. */
  onPreview?: () => void;
  /** Explicit full playback; deliberately separate from card-body preview. */
  onPlayFull?: () => void;
  /** Double-click shortcut and visible accessible queue action. */
  onAddToQueue?: () => void;
  /** Emitted signal (documented; wiring comes with the data layer): card_play, card_open */
}

function PreviewCountdown({ seconds }: { seconds: number }) {
  const remaining = Math.max(0, Math.min(10, seconds));
  const circumference = 2 * Math.PI * 18;
  const offset = circumference * (1 - remaining / 10);
  return (
    <span
      role="status"
      aria-label={`${Math.ceil(remaining)} seconds left in preview`}
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-ink/35 backdrop-blur-[1px]"
    >
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-ink/75 text-paper shadow-e4">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 44 44"
          aria-hidden
        >
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth="3"
          />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-primary transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <span className="font-data text-sm font-semibold tabular-nums">
          {Math.ceil(remaining)}
        </span>
      </span>
    </span>
  );
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

function CardArt({
  texture,
  artUrl,
  art,
  title,
  className,
}: {
  texture?: TextureName;
  artUrl?: string;
  art?: React.ReactNode;
  title: string;
  className?: string;
}) {
  if (art) {
    return <div className={className}>{art}</div>;
  }
  return (
    <Artwork
      src={artUrl}
      texture={texture ?? "tx-k-marble"}
      alt={title}
      className={className}
    />
  );
}

function PlayOverlay({
  playing,
  onPlayFull,
}: {
  playing: boolean;
  onPlayFull?: () => void;
}) {
  const interactive = Boolean(onPlayFull);
  return (
    // Every consumer (FeedShelf, search results, queue rows) already wraps
    // the card in its own role="button" element — that wrapper is the
    // accessible control. This overlay is hover-reveal decoration, so it's
    // pulled out of the a11y tree with aria-hidden. That's only valid
    // because the PlayerButton below is tabIndex={-1}: aria-hidden on a
    // container that still held a focusable element would trap keyboard
    // focus on an invisible node.
    <span
      aria-hidden={interactive ? undefined : "true"}
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
          tabIndex={interactive ? 0 : -1}
          aria-label={
            interactive
              ? playing
                ? "Pause full song"
                : "Play full song"
              : playing
                ? "Pause"
                : "Play"
          }
          onClick={(event) => {
            event.stopPropagation();
            onPlayFull?.();
          }}
          data-signal="card_play"
        >
          <IconSwap
            active={playing ? "pause" : "play"}
            icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
          />
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
  art,
  duration,
  size = "md",
  variant = "boxy",
  playing = false,
  previewSecondsRemaining,
  playable = true,
  className,
  onPreview,
  onPlayFull,
  onAddToQueue,
}: MediaCardProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    []
  );

  const interactive = Boolean(onPreview || onAddToQueue);
  const activate = (event: React.MouseEvent) => {
    if (event.detail >= 2 && onAddToQueue) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onAddToQueue();
      return;
    }
    if (!onPreview) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onPreview();
    }, 220);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === "Enter" || event.key === " ") && onPreview) {
      event.preventDefault();
      onPreview();
    }
  };
  const interaction = interactive
    ? {
        role: "button",
        tabIndex: 0,
        "aria-label": `Preview ${title} for 10 seconds`,
        onClick: activate,
        onDoubleClick: (event: React.MouseEvent) => event.preventDefault(),
        onKeyDown,
      }
    : {};

  const queueButton = onAddToQueue ? (
    <PlayerButton
      variant="secondary"
      size="sm"
      aria-label={`Add ${title} to queue`}
      onClick={(event) => {
        event.stopPropagation();
        onAddToQueue();
      }}
      className="absolute right-2 top-2 z-20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <PlusIcon />
    </PlayerButton>
  ) : null;

  if (variant === "extended") {
    return (
      <div
        {...interaction}
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
            size === "sm"
              ? "w-12 h-12"
              : size === "md"
                ? "w-16 h-16"
                : "w-24 h-24"
          )}
        >
          <CardArt
            texture={texture}
            artUrl={artUrl}
            art={art}
            title={title}
            className="absolute inset-0 w-full h-full"
          />
          {playable ? (
            <PlayOverlay playing={playing} onPlayFull={onPlayFull} />
          ) : null}
          {queueButton}
          {previewSecondsRemaining != null ? (
            <PreviewCountdown seconds={previewSecondsRemaining} />
          ) : null}
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
      {...interaction}
      className={cn(
        "group relative shrink-0 rounded-lg bg-card border border-border shadow-e1 p-2.5",
        "hover:shadow-e3 hover:-translate-y-1 transition-all duration-base cursor-pointer",
        BOXY_WIDTHS[size],
        className
      )}
      data-signal="card_play"
    >
      <div className="relative aspect-square rounded-md overflow-hidden">
        <CardArt
          texture={texture}
          artUrl={artUrl}
          art={art}
          title={title}
          className="absolute inset-0 w-full h-full"
        />
        {playable ? (
          <PlayOverlay playing={playing} onPlayFull={onPlayFull} />
        ) : null}
        {queueButton}
        {previewSecondsRemaining != null ? (
          <PreviewCountdown seconds={previewSecondsRemaining} />
        ) : null}
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
