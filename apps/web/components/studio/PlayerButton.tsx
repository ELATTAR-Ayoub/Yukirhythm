import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoopIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";

// Transport control — a machine key in a round shell.
// Press: travels down instantly (80ms). Release: springs back (250ms overshoot).
const playerButtonVariants = cva(
  "inline-flex items-center justify-center rounded-full select-none transition-all duration-base ease-spring active:duration-tick active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-btn-primary hover:bg-primary/90 active:shadow-btn-down",
        stylized:
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
      variant: "stylized",
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
          {loading ? <LoopIcon className="animate-spin" /> : children}
        </span>
      </button>
    );
  }
);
PlayerButton.displayName = "PlayerButton";

export { PlayerButton, playerButtonVariants };
