import { cn } from "@/lib/utils";
import Texture, { TextureName } from "@/components/studio/Texture";

interface EmptyStateProps {
  title: string;
  hint?: string;
  texture?: TextureName;
  action?: React.ReactNode;
  className?: string;
}

/** Empty state — dithered art tile + pixel-label message. */
export default function EmptyState({
  title,
  hint,
  texture = "tx-k-ascii-ripple",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-14 px-6",
        className
      )}
    >
      <Texture
        name={texture}
        className="w-24 h-24 rounded-lg border border-border mb-5"
      />
      <div className="font-pixel text-lg">{title}</div>
      {hint ? (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">{hint}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
