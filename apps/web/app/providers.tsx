"use client";

import { usePathname } from "next/navigation";

// components
import Header from "@/components/Header";
import PlayerHydration from "@/components/PlayerHydration";
import ThemeWatcher from "@/components/ThemeWatcher";

// Firebase
import { AuthContextProvider } from "@/context/AuthContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The design-system area has its own navigation (bottom bar / side nav) —
  // the floating Header circle would be redundant chrome there.
  const inDesignSystem = pathname?.startsWith("/design-system") ?? false;

  // The phase-8 real app (/live now, the app root later) runs on its own
  // StudioProvider and must not sit under the legacy AuthContext loader gate,
  // which is removed with the landing app in phase 8. Bypass the legacy chrome.
  const isRealApp = pathname?.startsWith("/live") ?? false;
  if (isRealApp) {
    return (
      <>
        <ThemeWatcher />
        {children}
      </>
    );
  }

  return (
    <AuthContextProvider>
      <ThemeWatcher />
      <PlayerHydration />
      {inDesignSystem ? null : <Header />}
      <main className={` relative w-full min-h-screen `}>{children}</main>
    </AuthContextProvider>
  );
}
