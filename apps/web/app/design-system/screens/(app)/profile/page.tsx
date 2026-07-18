"use client";

import {
  BarChartIcon,
  CounterClockwiseClockIcon,
  GearIcon,
  LockClosedIcon,
} from "@radix-ui/react-icons";

import PageHeader from "@/components/studio/screens/PageHeader";
import ProfileBadge from "@/components/studio/screens/ProfileBadge";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import { MenuList, MenuRow } from "@/components/studio/screens/MenuList";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

const BASE = "/design-system/screens";

export default function ProfileHub() {
  const { user } = useMockStudio();

  if (!user) {
    return (
      <div>
        <PageHeader title="Profile" />
        <SignInPrompt hint="Your profile, stats and settings live here." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="space-y-6 max-w-xl">
        <ProfileBadge user={user} />
        <MenuList>
          <MenuRow
            href={`${BASE}/profile/stats`}
            icon={<BarChartIcon />}
            label="Listening stats"
            hint="Minutes, top artists, daily patterns"
          />
          <MenuRow
            href={`${BASE}/profile/recents`}
            icon={<CounterClockwiseClockIcon />}
            label="Recents"
            hint="Everything you've played lately"
          />
          <MenuRow
            href={`${BASE}/profile/settings`}
            icon={<GearIcon />}
            label="Settings"
            hint="Audio, language, account"
          />
          <MenuRow
            href={`${BASE}/profile/privacy`}
            icon={<LockClosedIcon />}
            label="Privacy"
            hint="What we collect and why"
          />
        </MenuList>
      </div>
    </div>
  );
}
