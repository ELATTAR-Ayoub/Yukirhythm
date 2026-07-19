"use client";

import { useEffect } from "react";

/**
 * Keeps the html `dark` class in sync with the OS preference while the page
 * is open. The initial, pre-hydration state is set by the no-FOUC script in
 * the root layout (same `theme` localStorage key next-themes used).
 */
export default function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("theme");
      } catch {
        /* storage unavailable — follow the system */
      }
      // Dark ships as the default; only an explicit "system" defers to the OS.
      const dark =
        stored === null || stored === "dark" || (stored === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return null;
}
