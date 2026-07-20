"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { useSignOut } from "@/components/studio/screens/useSignOut";
import { AUTH, CREDITS, HOME, PROFILE, SEARCH } from "./routes";

const MENU = [
  { href: `${PROFILE}/view`, label: "Profile" },
  { href: `${PROFILE}/stats`, label: "Stats" },
  { href: `${PROFILE}/recents`, label: "Recents" },
  { href: `${PROFILE}/settings`, label: "Settings" },
  { href: `${PROFILE}/privacy`, label: "Privacy" },
  { href: CREDITS, label: "Credits" },
];

/**
 * The shell's fixed top bar. The search field is the only way into the search
 * page on desktop — focusing it routes there, so typing never happens on a
 * screen that cannot show results.
 */
export default function StudioHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, search, clearSearch } = useMockStudio();
  const handleSignOut = useSignOut();
  const [q, setQ] = useState("");

  // The field is local state but the results live in the studio context, so
  // they can drift apart across navigation — stale results outliving the query
  // that produced them. Leaving the search page abandons the search, which
  // keeps the two in sync by construction.
  useEffect(() => {
    if (pathname !== SEARCH) {
      // Genuinely an external-store sync: clearSearch() lives in the studio
      // context and cannot be called during render. setQ must reset with it or
      // the two drift again, and it bails out when q is already "" — so the
      // extra render only happens when there really was a query to abandon.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQ("");
      clearSearch();
    }
  }, [pathname, clearSearch]);

  const onChange = (value: string) => {
    setQ(value);
    if (value.trim()) {
      search(value);
    } else {
      clearSearch();
    }
  };

  return (
    <header className="h-[var(--shell-header-h)] shrink-0 flex items-center gap-3 px-3">
      {/* No wordmark beside the mark — the asset already contains one, so the
          text set the name twice. The alt carries it for anyone who can't see
          the logo, since there is no visible text to name this link now. */}
      <Link href={HOME} className="flex items-center shrink-0 px-1">
        <Image
          src="/svgs/logo_light.svg"
          width={20}
          height={20}
          alt="Yukirhythm"
          className="h-5 w-auto object-contain"
        />
      </Link>

      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <Link
          href={HOME}
          aria-label="Home"
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
            "bg-secondary text-foreground hover:text-primary",
            "transition-colors duration-fast"
          )}
        >
          <HomeIcon className="w-4 h-4" />
        </Link>
        <div className="relative w-full max-w-[480px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            aria-label="Search"
            placeholder="What do you want to play?"
            className="pl-9 rounded-full"
            data-signal="shell_search"
            // Only route in — refocusing while already on /search (tabbing
            // back in, focus returning after a dialog closes) must not push.
            onFocus={() => {
              if (pathname !== SEARCH) router.push(SEARCH);
            }}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>

      <div className="shrink-0">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Avatar className="w-9 h-9 border border-border">
                  <AvatarFallback className="bg-cobalt text-snow font-ui text-xs">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {MENU.map(({ href, label }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href}>{label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleSignOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href={AUTH}
            className="font-ui text-sm px-4 py-2 rounded-full bg-secondary hover:text-primary transition-colors duration-fast"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
