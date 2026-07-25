// apps/web/app/deck-lab/page.tsx
"use client";

import CarouselDeck from "@/components/studio/deck/CarouselDeck";
import type { DeckTrack } from "@/components/studio/DiscDeck";

const TRACKS: DeckTrack[] = [
  {
    title: "A.D. Police Opening",
    artist: "KISIDAKYOUDAN",
    artUrl: "/textures/tx-k2-vinyl.png",
  },
  {
    title: "Night Cruise '86",
    artist: "Studio Yuki",
    artUrl: "/textures/tx-k-marble.png",
  },
  {
    title: "Neon Rain",
    artist: "Analog Ghost",
    artUrl: "/textures/tx-k2-checker.png",
  },
  {
    title: "Terminal Dream",
    artist: "Metro Circuit",
    artUrl: "/textures/tx-k-silk.png",
  },
  {
    title: "Last Train Home",
    artist: "Kissaten Club",
    artUrl: "/textures/tx-k2-horizon.png",
  },
];

export default function DeckLabPage() {
  return (
    <main className="min-h-screen w-full bg-[#101010] text-[#f7f6f3] flex items-center justify-center p-6">
      <CarouselDeck tracks={TRACKS} className="max-w-3xl" />
    </main>
  );
}
