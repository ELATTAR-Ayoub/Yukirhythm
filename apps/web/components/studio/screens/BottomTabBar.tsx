"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  StackIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";

const BASE = "/design-system/screens";

const TABS = [
  { href: `${BASE}/home`, label: "Home", icon: HomeIcon },
  { href: `${BASE}/search`, label: "Search", icon: MagnifyingGlassIcon },
  { href: `${BASE}/library`, label: "Library", icon: StackIcon },
];

/** Mobile-only bottom navigation — Profile lives behind the header avatar. */
export default function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur"
    >
      <div className="flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href) ?? false;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5",
                "font-label text-[10px] uppercase tracking-wider transition-colors duration-fast",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
