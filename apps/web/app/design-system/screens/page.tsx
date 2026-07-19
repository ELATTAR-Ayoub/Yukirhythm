import Link from "next/link";
import Texture, { type TextureName } from "@/components/studio/Texture";
import SectionLabel from "@/components/studio/SectionLabel";
import ScreensFrame from "@/components/studio/screens/ScreensFrame";

const SCREENS: {
  href: string;
  title: string;
  mirrors: string;
  texture: TextureName;
}[] = [
  {
    href: "home",
    title: "Home",
    mirrors: "Jump back in + new releases, global player.",
    texture: "tx-k2-vinyl",
  },
  {
    href: "search",
    title: "Search",
    mirrors: "Live results, you-might-like, explore tiles.",
    texture: "tx-k2-static",
  },
  {
    href: "library",
    title: "Library",
    mirrors: "Type chips, pinned Liked Songs, playlist drawers.",
    texture: "tx-k-marble",
  },
  {
    href: "profile",
    title: "Profile",
    mirrors: "Hub → view, stats, recents, settings, privacy.",
    texture: "tx-k-silk",
  },
  {
    href: "auth",
    title: "Auth",
    mirrors: "One aurora door — Google or Facebook, no forms.",
    texture: "tx-k2-horizon",
  },
  {
    href: "credits",
    title: "Credits",
    mirrors: "Aurora author card + social badges.",
    texture: "tx-k2-topo",
  },
];

export default function ScreensIndex() {
  return (
    <ScreensFrame>
      <Link
        href="/design-system"
        className="inline-block mb-4 font-label text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors duration-fast"
      >
        ← Design System
      </Link>
      <SectionLabel>Living previews</SectionLabel>
      <h1 className="type-h1 mt-1">Screens</h1>
      <p className="type-p text-muted-foreground mt-2 max-w-2xl">
        The app&apos;s pages rebuilt on the studio system, driven by mock data.
        Play, search, switch tabs, sign in and out — every flow runs locally,
        nothing hits the network.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
        {SCREENS.map((s) => (
          <Link
            key={s.href}
            href={`/design-system/screens/${s.href}`}
            className="group rounded-lg border border-border bg-card overflow-hidden hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
          >
            <Texture name={s.texture} className="h-28 w-full" />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="type-h3">{s.title}</span>
                <span className="type-label text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
                  OPEN →
                </span>
              </div>
              <p className="type-muted mt-1.5">{s.mirrors}</p>
            </div>
          </Link>
        ))}
      </div>
    </ScreensFrame>
  );
}
