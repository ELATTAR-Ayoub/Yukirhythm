"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import ToggleSwitch from "@/components/studio/screens/ToggleSwitch";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { SCREENS } from "@/components/studio/shell/routes";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

function PrivacyRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="font-ui font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </div>
      <ToggleSwitch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

export default function PrivacyScreen() {
  const { user } = useMockStudio();
  const [history, setHistory] = useState(true);
  const [recs, setRecs] = useState(true);
  const [publicProfile, setPublicProfile] = useState(false);
  if (!user) return <SignInPrompt />;

  return (
    <div className="space-y-6">
      <BackHeader title="Privacy" backHref={`${BASE}/profile`} />

      <p className="type-small text-muted-foreground">
        Yukirhythm learns from what you play to shape recommendations. You
        control every signal below.
      </p>

      <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
        <PrivacyRow
          label="Save listening history"
          hint="Powers Recents and your stats."
          checked={history}
          onCheckedChange={setHistory}
        />
        <PrivacyRow
          label="Personalized recommendations"
          hint="Uses your listening behavior to suggest music."
          checked={recs}
          onCheckedChange={setRecs}
        />
        <PrivacyRow
          label="Public profile"
          hint="Let others see your playlists and stats."
          checked={publicProfile}
          onCheckedChange={setPublicProfile}
        />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => toast("Listening history cleared (mock)")}
      >
        Clear listening history
      </Button>
    </div>
  );
}
