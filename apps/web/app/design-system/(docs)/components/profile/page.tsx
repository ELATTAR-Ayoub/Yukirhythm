"use client";

import { useState } from "react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import ProfileBadge from "@/components/studio/screens/ProfileBadge";
import { MenuList, MenuRow } from "@/components/studio/screens/MenuList";
import StatCard from "@/components/studio/screens/StatCard";
import ToggleSwitch from "@/components/studio/screens/ToggleSwitch";
import SocialAuthButtons from "@/components/studio/screens/SocialAuthButtons";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import { MOCK_USER } from "@/components/studio/screens/mock-data";
import { BarChartIcon } from "@radix-ui/react-icons";

function Demos() {
  const [on, setOn] = useState(true);

  return (
    <div>
      <h1 className="type-h1 mb-8">Profile &amp; States</h1>

      <DsSection index="01" title="ProfileBadge">
        <StatePanel
          name="ProfileBadge"
          signal="profile_open"
          views={{ default: <ProfileBadge user={MOCK_USER} /> }}
        />
      </DsSection>

      <DsSection index="02" title="MenuList">
        <StatePanel
          name="MenuRow / MenuList"
          signal="hub_navigate"
          views={{
            default: (
              <MenuList>
                <MenuRow
                  href="#"
                  icon={<BarChartIcon />}
                  label="Listening stats"
                  hint="Minutes, top artists, daily patterns"
                />
              </MenuList>
            ),
          }}
        />
      </DsSection>

      <DsSection index="03" title="StatCard">
        <StatePanel
          name="StatCard"
          signal="—"
          views={{
            default: (
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <StatCard label="This week" value="312 min" />
                <StatCard
                  label="Streak"
                  value="9 days"
                  hint="listened every day"
                />
              </div>
            ),
          }}
        />
      </DsSection>

      <DsSection index="04" title="ToggleSwitch">
        <StatePanel
          name="ToggleSwitch"
          signal="privacy_toggle"
          views={{
            default: (
              <ToggleSwitch
                checked={on}
                onCheckedChange={setOn}
                aria-label="Demo toggle"
              />
            ),
          }}
        />
      </DsSection>

      <DsSection index="05" title="Auth & gates">
        <StatePanel
          name="SocialAuthButtons / SignInPrompt"
          signal="auth_continue"
          views={{
            auth: (
              <div className="max-w-sm">
                <SocialAuthButtons />
              </div>
            ),
            gate: <SignInPrompt />,
          }}
        />
      </DsSection>
    </div>
  );
}

export default function ProfileComponentsPage() {
  return (
    <MockStudioProvider>
      <Demos />
    </MockStudioProvider>
  );
}
