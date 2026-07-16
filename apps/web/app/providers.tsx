"use client";

import { ThemeProvider } from "next-themes";

// components
import Header from "@/components/Header";
import PlayerHydration from "@/components/PlayerHydration";

// Firebase
import { AuthContextProvider } from "@/context/AuthContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthContextProvider>
      <ThemeProvider attribute="class">
        <PlayerHydration />
        <Header />
        <main className={` relative w-full min-h-screen `}>{children}</main>
      </ThemeProvider>
    </AuthContextProvider>
  );
}
