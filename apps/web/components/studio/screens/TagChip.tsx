"use client";

import { cn } from "@/lib/utils";

interface TagChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Pill chip — library type filters, playlist tags, form kind pickers. */
export function TagChip({ label, active = false, onClick, className }: TagChipProps) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1",
        "font-label text-[10px] uppercase tracking-wider transition-colors duration-fast",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border",
        onClick && "cursor-pointer hover:border-primary hover:text-primary",
        className
      )}
    >
      {label}
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
