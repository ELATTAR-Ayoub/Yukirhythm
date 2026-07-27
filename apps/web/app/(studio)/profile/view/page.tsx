"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import StatCard from "@/components/studio/screens/StatCard";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { MOCK_STATS } from "@/components/studio/screens/mock-data";
import { SCREENS } from "@/components/studio/shell/routes";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

export default function ViewProfileScreen() {
  const { user } = useMockStudio();
  if (!user) return <SignInPrompt />;

  return (
    <div>
      <BackHeader title="Your profile" fallbackHref={`${BASE}/profile`} />
      <div className="flex flex-col items-center gap-3 py-6">
        <Avatar className="w-24 h-24 border border-border">
          <AvatarFallback className="bg-cobalt text-snow font-ui text-3xl">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <h2 className="font-display font-bold text-2xl">{user.userName}</h2>
        <p className="type-small text-muted-foreground">{user.email}</p>
        <p className="font-label text-[10px] uppercase tracking-wider text-muted-foreground">
          Joined March 2024
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Followers" value={String(user.followers)} />
        <StatCard label="Following" value={String(user.following)} />
        <StatCard
          label="Minutes"
          value={String(MOCK_STATS.minutesMonth)}
          hint="this month"
        />
      </div>
    </div>
  );
}
