"use client";

import ThemeWatcher from "@/components/ThemeWatcher";

/**
 * Root providers. The studio shell mounts its own StudioProvider, so all that
 * remains globally is the theme watcher — the legacy AuthContext, floating
 * Header and player hydration went with the landing app in phase 8.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeWatcher />
      {children}
    </>
  );
}
