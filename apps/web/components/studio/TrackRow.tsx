import { cn } from "@/lib/utils";
import Texture, { TextureName } from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import EqIndicator from "@/components/studio/EqIndicator";

interface TrackRowProps {
  index?: number;
  title: string;
  artist?: string;
  duration?: string;
  texture?: TextureName;
  artUrl?: string;
  playing?: boolean;
  selected?: boolean;
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
      <div className="w-6 flex justify-center shrink-0">
        {playing ? (
          <EqIndicator />
        ) : (
          <DataText className="text-sm text-muted-foreground">
            {index != null ? String(index).padStart(2, "0") : "--"}
          </DataText>
        )}
      </div>
      <div className="relative w-9 h-9 rounded-sm overflow-hidden shrink-0">
        {artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Texture
            name={texture ?? "tx-k-silk"}
            className="absolute inset-0 w-full h-full"
          />
        )}
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
        {artist ? (
          <div className="font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
            {artist}
          </div>
        ) : null}
      </div>
      {duration ? (
        <DataText className="text-sm text-muted-foreground shrink-0">
          {duration}
        </DataText>
      ) : null}
    </div>
  );
}
