"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@radix-ui/react-icons";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import DataText from "@/components/studio/DataText";
import type { MockUser } from "./mock-data";

const BASE = "/design-system/screens";

interface ProfileBadgeProps {
  user: MockUser;
}

/** Hub header card — tap to open the full view-profile screen. */
export default function ProfileBadge({ user }: ProfileBadgeProps) {
  return (
    <Link
      href={`${BASE}/profile/view`}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
    >
      <Avatar className="w-14 h-14 border border-border">
        <AvatarFallback className="bg-cobalt text-snow font-ui text-lg">
          {user.initials}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-lg truncate">
          {user.userName}
        </span>
        <span className="flex items-center gap-3 mt-0.5">
          <DataText className="text-xs text-muted-foreground">
            {user.followers} followers
          </DataText>
          <DataText className="text-xs text-muted-foreground">
            {user.following} following
          </DataText>
        </span>
      </span>
      <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
