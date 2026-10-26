"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
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
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled: boolean;
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
        disabled={disabled}
      />
    </div>
  );
}

export default function PrivacyScreen() {
  const {
    user,
    privacy,
    privacyLoading,
    updatePrivacy,
    clearListeningHistory,
  } = useMockStudio();
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const change = async (patch: Parameters<typeof updatePrivacy>[0]) => {
    if (saving) return;
    setSaving(true);
    try {
      await updatePrivacy(patch);
    } catch {
      toast.error("Couldn't save your privacy preference. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  if (!user) return <SignInPrompt />;

  return (
    <div className="space-y-6">
      <BackHeader title="Privacy" fallbackHref={`${BASE}/profile`} />

      <p className="type-small text-muted-foreground">
        Yukirhythm learns from what you play to shape recommendations. You
        control every signal below.
      </p>

      <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
        <PrivacyRow
          label="Save listening history"
          hint="Powers Recents and your stats."
          checked={privacy.saveHistory}
          disabled={privacyLoading || saving}
          onCheckedChange={(value) => void change({ saveHistory: value })}
        />
        <PrivacyRow
          label="Personalized recommendations"
          hint={
            user.authProvider === "guest"
              ? "Uses likes saved on this device to suggest music."
              : "Uses your listening behavior to suggest music."
          }
          checked={privacy.personalization}
          disabled={privacyLoading || saving}
          onCheckedChange={(value) => void change({ personalization: value })}
        />
        <PrivacyRow
          label="Public profile"
          hint={
            user.authProvider === "guest"
              ? "Sign in to create a public profile. Guest data stays on this device."
              : "Let others see your playlists and stats."
          }
          checked={privacy.publicProfile}
          disabled={privacyLoading || saving || user.authProvider === "guest"}
          onCheckedChange={(value) => void change({ publicProfile: value })}
        />
      </div>

      <Button
        variant="outline"
        className="w-full"
        disabled={saving}
        onClick={() => setConfirmClear(true)}
      >
        Clear listening history
      </Button>
      <AlertDialog
        open={confirmClear}
        onOpenChange={(open) => {
          if (!saving) setConfirmClear(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear listening history?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Your likes and playlists stay saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await clearListeningHistory();
                  setConfirmClear(false);
                  toast("Listening history cleared");
                } catch {
                  toast.error("Couldn't clear history. Please try again.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Clearing…" : "Clear history"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
