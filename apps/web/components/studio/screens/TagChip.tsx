"use client";

import { Cross2Icon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";

interface TagChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  /** Greys the chip out and blocks `onClick` — the mosaic-cover picker uses
   *  this when the draft has no tracks yet. */
  disabled?: boolean;
  /** Renders a nested "x" button that calls back with no args; the chip
   *  itself falls back to a plain `span` when `onClick` is absent (as
   *  before), so this never nests a button inside a button. */
  onRemove?: () => void;
  className?: string;
}

/** Pill chip — library type filters, playlist tags, form kind pickers,
 *  and (with `onRemove`) the removable tags typed into the create wizard. */
export function TagChip({
  label,
  active = false,
  onClick,
  disabled = false,
  onRemove,
  className,
}: TagChipProps) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={onClick && disabled ? true : undefined}
      aria-pressed={onClick ? active : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1",
        "font-label text-[10px] uppercase tracking-wider transition-colors duration-fast",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border",
        onClick &&
          !disabled &&
          "cursor-pointer hover:border-primary hover:text-primary",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            // A sibling of the label, not a descendant of an interactive
            // Tag — stopPropagation only matters when Tag is itself a
            // button (the Type picker never passes onRemove, so this is
            // purely defensive).
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${label}`}
          className={cn(
            "-mr-1 ml-0.5 rounded-full p-0.5 transition-colors duration-fast",
            "hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
        >
          <Cross2Icon className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </Tag>
  );
}

interface FilterChipRowProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Single-select chip row — the Library's content-type filter. */
export function FilterChipRow<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterChipRowProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group">
      {options.map((o) => (
        <TagChip
          key={o.value}
          label={o.label}
          active={o.value === value}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}
