"use client";

// components
import Header from "@/components/Header";
import PlayerHydration from "@/components/PlayerHydration";
import ThemeWatcher from "@/components/ThemeWatcher";

// Firebase
import { AuthContextProvider } from "@/context/AuthContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthContextProvider>
      <ThemeWatcher />
      <PlayerHydration />
      <Header />
      <main className={` relative w-full min-h-screen `}>{children}</main>
    </AuthContextProvider>
  );
}
