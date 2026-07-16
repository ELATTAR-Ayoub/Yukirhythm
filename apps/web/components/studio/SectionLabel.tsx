import { cn } from "@/lib/utils";

interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Mono catalogue label — uppercase, letter-spaced section markers
 * ("01 — THE FEELING" style) used across pages and the design system.
 */
export default function SectionLabel({
  className,
  children,
  ...props
}: SectionLabelProps) {
  return (
    <div
      className={cn(
        "font-label text-[11px] uppercase tracking-[0.2em] text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
