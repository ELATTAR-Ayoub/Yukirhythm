"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/studio/BrandIcons";
import AppearanceSetting from "@/components/studio/screens/AppearanceSetting";
import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import SectionLabel from "@/components/studio/SectionLabel";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

const BASE = "/design-system/screens";

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => toast(`“${label}” is mock-only for now`)}
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary transition-colors duration-fast text-left"
    >
      <span className="font-ui font-medium text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </button>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useMockStudio();
  const router = useRouter();
  if (!user) return <SignInPrompt />;

  return (
    <div className="space-y-8">
      <BackHeader title="Settings" backHref={`${BASE}/profile`} />

      <section>
        <SectionLabel>Playback</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          <SettingRow label="Audio quality" value="High" />
          <SettingRow label="Language" value="English" />
          <AppearanceSetting />
        </div>
      </section>

      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <GoogleIcon className="h-4 w-4" />
            <span className="font-ui font-medium text-sm flex-1">
              Connected with Google
            </span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
      </section>

      <Button
        variant="destructive"
        className="w-full"
        onClick={() => {
          signOut();
          toast("Signed out");
          router.push(`${BASE}/auth`);
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
