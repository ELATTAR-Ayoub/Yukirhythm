import { cn } from "@/lib/utils";
import SectionLabel from "@/components/studio/SectionLabel";

/** Section wrapper for design-system pages. */
export function DsSection({
  index,
  title,
  children,
  className,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-16", className)}>
      <SectionLabel className="mb-1">
        {index} — {title}
      </SectionLabel>
      <div className="h-px bg-border mb-6" />
      {children}
    </section>
  );
}

/** Color token swatch with name + value. */
export function TokenSwatch({
  name,
  value,
  className,
  swatchClassName,
}: {
  name: string;
  value: string;
  className?: string;
  swatchClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className={cn(
          "h-20 rounded-lg border border-border shadow-e1",
          swatchClassName
        )}
      />
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="font-label text-[11px] text-muted-foreground uppercase">
          {value}
        </div>
      </div>
    </div>
  );
}

/** Type specimen row: role metadata on the left, live sample on the right. */
export function SpecimenBlock({
  role,
  font,
  usage,
  children,
}: {
  role: string;
  font: string;
  usage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-8 py-5 border-b border-border last:border-b-0">
      <div>
        <div className="text-sm font-semibold">{role}</div>
        <div className="font-label text-[11px] text-muted-foreground uppercase tracking-wider">
          {font}
        </div>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {usage}
        </div>
      </div>
      <div className="min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** Labeled demo cell used in grids (shadows, motion, spacing…). */
export function DemoCell({
  label,
  sub,
  children,
  className,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex-1 flex items-center justify-center rounded-lg bg-card border border-border p-6 min-h-[110px]">
        {children}
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub ? (
          <div className="font-label text-[11px] text-muted-foreground">
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}
