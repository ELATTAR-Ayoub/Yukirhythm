import { cn } from "@/lib/utils";

/** Loading placeholder for MediaCard (boxy). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-48 shrink-0 rounded-lg bg-card border border-border p-2.5 animate-pulse",
        className
      )}
      aria-hidden
    >
      <div className="aspect-square rounded-md bg-muted" />
      <div className="h-3.5 bg-muted rounded-sm mt-3 w-3/4" />
      <div className="h-2.5 bg-muted rounded-sm mt-2 w-1/2" />
    </div>
  );
}

/** Loading placeholder for TrackRow. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-3 px-3 py-2 animate-pulse", className)}
      aria-hidden
    >
      <div className="w-6 h-3 bg-muted rounded-sm" />
      <div className="w-9 h-9 bg-muted rounded-sm" />
      <div className="flex-1">
        <div className="h-3.5 bg-muted rounded-sm w-2/5" />
        <div className="h-2.5 bg-muted rounded-sm mt-1.5 w-1/4" />
      </div>
      <div className="w-10 h-3 bg-muted rounded-sm" />
    </div>
  );
}
