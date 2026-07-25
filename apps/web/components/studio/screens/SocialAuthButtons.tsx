"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FacebookIcon, GoogleIcon } from "@/components/studio/BrandIcons";
import { useMockStudio } from "./MockStudioProvider";

interface SocialAuthButtonsProps {
  /** Fires immediately on click, before the popup even opens — not after any
   *  session exists. The auth page (app/auth/page.tsx) no longer wires this
   *  up; it now exits on the settled Firebase session instead. Kept for any
   *  other caller that still wants a same-tick hook into the click. */
  onAuthed?: () => void;
}

/** The whole auth surface: Google + Facebook. Firebase makes login = signup. */
export default function SocialAuthButtons({
  onAuthed,
}: SocialAuthButtonsProps) {
  const { signIn } = useMockStudio();

  const continueWith = (provider: "google" | "facebook") => {
    signIn(provider);
    // "Signed in" would be a lie at this point — the popup has only just
    // opened, and the user hasn't completed (or may abandon) it yet.
    toast(`Opening ${provider === "google" ? "Google" : "Facebook"} sign-in…`);
    onAuthed?.();
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <Button className="w-full" onClick={() => continueWith("google")}>
        <GoogleIcon className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => continueWith("facebook")}
      >
        <FacebookIcon className="mr-2 h-4 w-4" />
        Continue with Facebook
      </Button>
    </div>
  );
}
