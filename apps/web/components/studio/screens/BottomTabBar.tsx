"use client";

import { usePathname } from "next/navigation";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  StackIcon,
} from "@radix-ui/react-icons";

import NavTabs, { type NavTabItem } from "./NavTabs";
import { SCREENS } from "@/components/studio/shell/routes";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

const TABS: NavTabItem[] = [
  { href: `${BASE}/home`, label: "Home", icon: HomeIcon },
  { href: `${BASE}/search`, label: "Search", icon: MagnifyingGlassIcon },
  { href: `${BASE}/library`, label: "Library", icon: StackIcon },
];

/**
 * Mobile-only bottom navigation — Profile lives behind the header avatar.
 * Its height is pinned to the --bottom-nav-h token so MiniPlayerBar can offset
 * against it; change the token in globals.css, not the class here.
 */
export default function BottomTabBar() {
  const pathname = usePathname();
  const activeHref =
    TABS.find((tab) => pathname?.startsWith(tab.href))?.href ?? null;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden h-[var(--bottom-nav-h)]"
    >
      <div className="p-2">
        <NavTabs
          items={TABS}
          activeHref={activeHref}
          iconsOnly
          className="bg-muted/15 backdrop-blur-md"
        />
      </div>
    </nav>
  );
}
