"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

import { useIsDesktop } from "@/components/studio/shell/useBreakpoint";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Follows the html `dark` class (managed by the layout script + ThemeWatcher). */
function useResolvedTheme(): ToasterProps["theme"] {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("system");

  useEffect(() => {
    const root = document.documentElement;
    const apply = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/**
 * Toasts come from the top on a phone and the bottom-right on desktop.
 *
 * Bottom is the desktop convention, but on mobile that corner is already
 * occupied — the bottom tab bar and the mini player both live there, so a
 * toast either covers the transport or gets covered by it. The top edge is
 * clear on every mobile screen.
 *
 * `useIsDesktop` resolves false on the first render by design, so the first
 * paint uses the mobile position; nothing has been toasted that early, so the
 * settle is invisible.
 */
function usePosition(): NonNullable<ToasterProps["position"]> {
  return useIsDesktop() ? "bottom-right" : "top-center";
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useResolvedTheme();
  const position = usePosition();

  return (
    <Sonner
      theme={theme}
      position={position}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
