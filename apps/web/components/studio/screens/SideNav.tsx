"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  StackIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMockStudio } from "./MockStudioProvider";

const BASE = "/design-system/screens";

const ITEMS = [
  { href: `${BASE}/home`, label: "Home", icon: HomeIcon },
  { href: `${BASE}/search`, label: "Search", icon: MagnifyingGlassIcon },
  { href: `${BASE}/library`, label: "Library", icon: StackIcon },
];

/** Desktop-only sidebar — nav on top, the avatar footer opens Profile. */
export default function SideNav() {
  const pathname = usePathname();
  const { user } = useMockStudio();
  return (
    <aside className="hidden md:flex sticky top-24 self-start w-52 shrink-0 flex-col gap-1 h-[calc(100vh-12rem)] min-h-[24rem]">
      <Link href={`${BASE}/home`} className="flex items-center gap-2 px-3 py-2 mb-3">
        <Image
          src="/svgs/logo_light.svg"
          width={20}
          height={20}
          alt=""
          className="h-5 w-auto object-contain"
        />
        <span className="font-display font-bold tracking-tight">Yukirhythm</span>
      </Link>
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href) ?? false;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md font-ui text-sm",
                "transition-colors duration-fast hover:bg-secondary",
                active ? "bg-secondary text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Link
        href={user ? `${BASE}/profile` : `${BASE}/auth`}
        className="mt-auto flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary transition-colors duration-fast"
      >
        <Avatar className="w-8 h-8 border border-border">
          <AvatarFallback className="bg-cobalt text-snow font-ui text-xs">
            {user ? user.initials : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="font-ui text-sm truncate">
          {user ? user.userName : "Sign in"}
        </span>
      </Link>
    </aside>
  );
}
