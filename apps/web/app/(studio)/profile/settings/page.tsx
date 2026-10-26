"use client";

import { Button } from "@/components/ui/button";
import { FacebookIcon, GoogleIcon } from "@/components/studio/BrandIcons";
import AppearanceSetting from "@/components/studio/screens/AppearanceSetting";
import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import SectionLabel from "@/components/studio/SectionLabel";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { useSignOut } from "@/components/studio/screens/useSignOut";
import { SCREENS } from "@/components/studio/shell/routes";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full flex items-center justify-between px-4 py-3.5 text-left">
      <span className="font-ui font-medium text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

export default function SettingsScreen() {
  const { user } = useMockStudio();
  const handleSignOut = useSignOut();
  if (!user) return <SignInPrompt />;

  return (
    <div className="space-y-8">
      <BackHeader title="Settings" fallbackHref={`${BASE}/profile`} />

      <section>
        <SectionLabel>Playback</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          <SettingRow label="Audio quality" value="Automatic (YouTube)" />
          <SettingRow label="Language" value="English" />
          <AppearanceSetting />
        </div>
      </section>

      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            {user.authProvider === "guest" ? null : user.authProvider ===
              "facebook" ? (
              <FacebookIcon className="h-4 w-4" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
            <span className="font-ui font-medium text-sm flex-1">
              {user.authProvider === "guest"
                ? "Guest on this device"
                : `Connected with ${user.authProvider === "facebook" ? "Facebook" : "Google"}`}
            </span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
        {user.authProvider === "guest" && (
          <p className="mt-3 type-small text-muted-foreground">
            Your library and preferences stay in this browser, including after
            signing out. Clearing site data removes them. Sign out to choose an
            account; guest data stays separate.
          </p>
        )}
      </section>

      <Button variant="destructive" className="w-full" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}
