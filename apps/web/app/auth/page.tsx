"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { devSignIn, signInAsGuest } from "@/lib/studio/useAuth";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { TextureBackground } from "@/components/ui/texture-background";
import SocialAuthButtons from "@/components/studio/screens/SocialAuthButtons";
import ScreensFrame from "@/components/studio/screens/ScreensFrame";
import { SCREENS } from "@/components/studio/shell/routes";
import { useAuthState } from "@/lib/studio/useAuth";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

/** One door for everyone — Firebase social sign-in creates accounts on first login. */
export default function AuthScreen() {
  const router = useRouter();
  const { user, loading } = useAuthState();
  const [localSigningIn, setLocalSigningIn] = useState(false);

  // The page's only exit: the moment Firebase reports a session — whether the
  // user just signed in here or arrived already signed in — hand off to the
  // root, which decides between Search (new account) and Home (returning).
  // `onAuthed` was the wrong trigger: it fires when the popup OPENS, before
  // any session exists.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  return (
    <ScreensFrame>
      <div className="rounded-lg overflow-hidden border border-border">
        {/* Fills the viewport exactly: 100vh minus ScreensFrame's p-2/sm:p-6
            edge offset and this wrapper's 2px border, so the card is centred
            on the page without spilling into a scrollbar. */}
        <TextureBackground className="!w-full !h-[calc(100vh-1rem-2px)] sm:!h-[calc(100vh-3rem-2px)] p-6">
          <div className="relative w-full sm:max-w-[400px] flex flex-col items-center gap-4">
            <Image
              src="/svgs/logo_light.svg"
              width={24}
              height={24}
              alt="Yukirhythm"
              className="h-6 w-auto object-contain"
            />
            <h1 className="type-h1 text-foreground text-center">
              Listen your way
            </h1>
            <p className="type-small text-center text-muted-foreground">
              Sign in to sync your library, or listen as a guest on this device.
            </p>

            <SocialAuthButtons />
            <Button
              variant="outline"
              onClick={() => {
                try {
                  signInAsGuest();
                } catch {
                  toast.error(
                    "Guest mode needs browser storage. Allow local storage and try again."
                  );
                }
              }}
            >
              Continue as guest
            </Button>
            <p className="type-small text-center text-muted-foreground">
              Guest likes, playlists, history, and preferences stay in this
              browser. Clearing site data removes them.
            </p>
            {process.env.NODE_ENV === "development" &&
            process.env.NEXT_PUBLIC_AUTH_EMULATOR ? (
              <Button
                variant="outline"
                disabled={localSigningIn}
                onClick={async () => {
                  setLocalSigningIn(true);
                  try {
                    await devSignIn(
                      "local-audit@example.test",
                      "local-emulator-only"
                    );
                  } catch {
                    toast.error(
                      "Local emulator sign-in failed. Check that the emulators are running."
                    );
                  } finally {
                    setLocalSigningIn(false);
                  }
                }}
              >
                {localSigningIn ? "Signing in…" : "Use local test account"}
              </Button>
            ) : null}

            <p className="type-label normal-case tracking-normal font-normal text-muted-foreground text-center">
              By continuing you agree to the{" "}
              <Link
                href={`${BASE}/terms`}
                className="text-foreground underline underline-offset-2 hover:text-primary transition-colors duration-fast"
              >
                Terms
              </Link>
              .
            </p>
          </div>
        </TextureBackground>
      </div>
    </ScreensFrame>
  );
}
