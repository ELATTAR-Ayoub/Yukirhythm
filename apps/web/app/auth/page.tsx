"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { TextureBackground } from "@/components/ui/texture-background";
import SocialAuthButtons from "@/components/studio/screens/SocialAuthButtons";
import ScreensFrame from "@/components/studio/screens/ScreensFrame";
import { isSafeAppPath, SCREENS } from "@/components/studio/shell/routes";
import { useAuthState } from "@/lib/studio/useAuth";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

/** One door for everyone — Firebase social sign-in creates accounts on first login. */
export default function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthState();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = isSafeAppPath(requestedReturnTo) ? requestedReturnTo : "/";

  // The page's only exit: the moment Firebase reports a session — whether the
  // user just signed in here or arrived already signed in — hand off to the
  // requested public page, or the root decision for a normal sign-in.
  // `onAuthed` was the wrong trigger: it fires when the popup OPENS, before
  // any session exists.
  useEffect(() => {
    if (!loading && user) router.replace(returnTo);
  }, [user, loading, router, returnTo]);

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
              One account for everything. Sign in or sign up in a single tap.
            </p>

            <SocialAuthButtons />

            <p className="type-label normal-case tracking-normal font-normal text-muted-foreground text-center">
              By continuing you agree to the mock{" "}
              <Link
                href={`${BASE}/terms`}
                className="text-foreground underline underline-offset-2 hover:text-primary transition-colors duration-fast"
              >
                Terms
              </Link>
              . Nothing here touches the network.
            </p>
          </div>
        </TextureBackground>
      </div>
    </ScreensFrame>
  );
}
