import { cn } from "@/lib/utils";

interface DataTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

/**
 * Numeric data in the digital LCD face (timestamps, BPM, counters).
 * Brand rule: all numbers render through this, never the UI font.
 */
export default function DataText({
  className,
  children,
  ...props
}: DataTextProps) {
  return (
    <span
      className={cn("font-data tracking-wide tabular-nums", className)}
      {...props}
    >
      {children}
    </span>
  );
}
