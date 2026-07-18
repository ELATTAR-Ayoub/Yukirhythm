import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Circular loading ring — sized by the host button's svg rules. */
export function CircleSpinner() {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Transport control — a machine key in a round shell.
// Press: travels down instantly (80ms). Release: springs back (250ms overshoot).
const playerButtonVariants = cva(
  "inline-flex items-center justify-center rounded-full select-none transition-all duration-base ease-spring active:duration-tick active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-btn-primary hover:bg-primary/90 active:shadow-btn-down",
        secondary:
          "main_shadow bg-secondary text-secondary-foreground active:shadow-btn-down",
        outline:
          "bg-card border border-input shadow-btn hover:bg-secondary active:shadow-btn-down",
        ghost: "text-foreground hover:bg-secondary active:bg-muted",
      },
      size: {
        sm: "h-7 w-7 [&_svg]:h-2.5 [&_svg]:w-2.5",
        base: "h-8 w-8 [&_svg]:h-3 [&_svg]:w-3",
        lg: "h-11 w-11 [&_svg]:h-4 [&_svg]:w-4",
        xl: "h-14 w-14 [&_svg]:h-5 [&_svg]:w-5",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "base",
    },
  }
);

export interface PlayerButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof playerButtonVariants> {
  /** Replaces the icon with a spinner and disables interaction */
  loading?: boolean;
  /** Toggled controls (loop, shuffle) — marks pressed state */
  active?: boolean;
}

const PlayerButton = React.forwardRef<HTMLButtonElement, PlayerButtonProps>(
  (
    { className, variant, size, loading = false, active = false, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        aria-pressed={active || undefined}
        disabled={loading || props.disabled}
        className={cn(
          playerButtonVariants({ variant, size }),
          active && "ring-2 ring-primary/50 shadow-btn-down",
          className
        )}
        {...props}
      >
        <span className="icon_clothes">
          {loading ? <CircleSpinner /> : children}
        </span>
      </button>
    );
  }
);
PlayerButton.displayName = "PlayerButton";

export { PlayerButton, playerButtonVariants };
