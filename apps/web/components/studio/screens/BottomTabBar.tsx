"use client";

import { usePathname } from "next/navigation";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  StackIcon,
} from "@radix-ui/react-icons";

import NavTabs, { type NavTabItem } from "./NavTabs";

const BASE = "/design-system/screens";

const TABS: NavTabItem[] = [
  { href: `${BASE}/home`, label: "Home", icon: HomeIcon },
  { href: `${BASE}/search`, label: "Search", icon: MagnifyingGlassIcon },
  { href: `${BASE}/library`, label: "Library", icon: StackIcon },
];

/** Mobile-only bottom navigation — Profile lives behind the header avatar. */
export default function BottomTabBar() {
  const pathname = usePathname();
  const activeHref =
    TABS.find((tab) => pathname?.startsWith(tab.href))?.href ?? null;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden backdrop-blur-md"
    >
      <div className="p-1.5">
        <NavTabs items={TABS} activeHref={activeHref} iconsOnly />
      </div>
    </nav>
  );
}
