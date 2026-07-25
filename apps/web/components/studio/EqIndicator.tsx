import { cn } from "@/lib/utils";

interface EqIndicatorProps {
  /** Paused freezes the bars at low height */
  playing?: boolean;
  className?: string;
}

/**
 * Tiny equalizer bars — the "this row is playing" signal.
 * Mint by default; inherits color via currentColor when overridden.
 */
export default function EqIndicator({
  playing = true,
  className,
}: EqIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-end gap-[2px] h-3.5 text-mint",
        className
      )}
      aria-label={playing ? "Playing" : "Paused"}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-[1px] bg-current h-full",
            playing ? "eq-bar" : "scale-y-[0.3] origin-bottom"
          )}
          style={playing ? { animationDelay: `${i * 0.18}s` } : undefined}
        />
      ))}
    </span>
  );
}
