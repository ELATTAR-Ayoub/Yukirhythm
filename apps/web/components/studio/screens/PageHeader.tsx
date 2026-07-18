"use client";

import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMockStudio } from "./MockStudioProvider";

const BASE = "/design-system/screens";

interface PageHeaderProps {
  title: string;
  /** Ghost icon buttons, right-aligned. */
  actions?: React.ReactNode;
}

/**
 * Shared screen header — avatar + title left, ghost controls right.
 * The avatar is the mobile way into Profile (desktop uses the SideNav footer),
 * so it hides at md+.
 */
export default function PageHeader({ title, actions }: PageHeaderProps) {
  const { user } = useMockStudio();
  return (
    <header className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={user ? `${BASE}/profile` : `${BASE}/auth`}
          aria-label={user ? "Open profile" : "Sign in"}
          className="md:hidden click-spring rounded-full shrink-0"
        >
          <Avatar className="border border-border">
            <AvatarFallback className="bg-cobalt text-snow font-ui text-sm">
              {user ? user.initials : "?"}
            </AvatarFallback>
          </Avatar>
        </Link>
        <h1 className="type-h2 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
    </header>
  );
}
