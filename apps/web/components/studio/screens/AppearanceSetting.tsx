"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "dark" | "light" | "system";

const ORDER: ThemeChoice[] = ["dark", "light", "system"];
const LABELS: Record<ThemeChoice, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

/** Dark is the product default — only an explicit "system" defers to the OS. */
function resolveDark(choice: ThemeChoice): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(choice: ThemeChoice) {
  const dark = resolveDark(choice);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem("theme", choice);
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
}

/**
 * The Appearance row. Writes the same `theme` key the no-FOUC script in the
 * root layout reads, so a reload keeps the choice without a flash.
 */
export default function AppearanceSetting() {
  // Server render can't know the stored choice; start on the default and
  // correct after mount so the markup matches.
  const [choice, setChoice] = useState<ThemeChoice>("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light" || stored === "system") {
        setChoice(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const cycle = () => {
    const nextChoice = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    setChoice(nextChoice);
    applyTheme(nextChoice);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Appearance: ${LABELS[choice]}. Tap to change.`}
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary transition-colors duration-fast text-left"
      data-signal="theme_change"
    >
      <span className="font-ui font-medium text-sm">Appearance</span>
      <span className="text-xs text-muted-foreground">{LABELS[choice]}</span>
    </button>
  );
}
