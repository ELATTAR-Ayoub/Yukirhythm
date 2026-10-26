"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
  disabled?: boolean;
}

/** Dependency-free switch for the privacy toggles. */
export default function ToggleSwitch({
  checked,
  onCheckedChange,
  "aria-label": ariaLabel,
  disabled,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border",
        "transition-colors duration-base outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-[1.125rem] w-[1.125rem] rounded-full bg-card shadow-e1",
          "transition-transform duration-base",
          checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
