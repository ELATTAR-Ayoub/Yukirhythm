"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FacebookIcon, GoogleIcon } from "@/components/studio/BrandIcons";
import { useMockStudio } from "./MockStudioProvider";

interface SocialAuthButtonsProps {
  /** Called after the mock session flips to signed-in (e.g. redirect home). */
  onAuthed?: () => void;
}

/** The whole auth surface: Google + Facebook. Firebase makes login = signup. */
export default function SocialAuthButtons({ onAuthed }: SocialAuthButtonsProps) {
  const { signIn } = useMockStudio();

  const continueWith = (provider: "Google" | "Facebook") => {
    signIn();
    toast(`Signed in with ${provider}`);
    onAuthed?.();
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <Button className="w-full" onClick={() => continueWith("Google")}>
        <GoogleIcon className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => continueWith("Facebook")}
      >
        <FacebookIcon className="mr-2 h-4 w-4" />
        Continue with Facebook
      </Button>
    </div>
  );
}
