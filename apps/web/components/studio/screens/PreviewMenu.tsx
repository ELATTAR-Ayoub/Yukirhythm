"use client";

import Link from "next/link";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMockStudio } from "./MockStudioProvider";

const BASE = "/design-system/screens";

/** Reskin of the app's floating nav menu; reflects mock auth state. */
export default function PreviewMenu() {
  const { user, signOut } = useMockStudio();

  return (
    <header className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6 text-foreground">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="click-spring outline-none rounded-full" aria-label="Menu">
            {user ? (
              <Avatar className="border border-border shadow-e2">
                <AvatarFallback className="bg-cobalt text-snow font-ui text-sm">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="flex items-center justify-center w-11 h-11 rounded-full bg-card border border-border shadow-e2">
                <HamburgerMenuIcon className="w-5 h-5" />
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-2 min-w-48">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-ui">{user ? user.userName : "Menu"}</span>
              {user ? (
                <span className="font-label text-[10px] normal-case tracking-normal text-muted-foreground">
                  {user.email}
                </span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Link href={`${BASE}/home`}>
            <DropdownMenuItem>Home</DropdownMenuItem>
          </Link>
          {user ? (
            <Link href={`${BASE}/profile`}>
              <DropdownMenuItem>Profile</DropdownMenuItem>
            </Link>
          ) : (
            <Link href={`${BASE}/auth`}>
              <DropdownMenuItem>Login</DropdownMenuItem>
            </Link>
          )}
          <Link href={`${BASE}/credits`}>
            <DropdownMenuItem>Credits</DropdownMenuItem>
          </Link>
          {user ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="bg-destructive text-destructive-foreground focus:bg-destructive/90 focus:text-destructive-foreground"
              >
                Log out
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
