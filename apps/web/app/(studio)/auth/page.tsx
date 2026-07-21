"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { TextureBackground } from "@/components/ui/texture-background";
import SocialAuthButtons from "@/components/studio/screens/SocialAuthButtons";
import ScreensFrame from "@/components/studio/screens/ScreensFrame";

const BASE = "/design-system/screens";

/** One door for everyone — Firebase social sign-in creates accounts on first login. */
export default function AuthScreen() {
  const router = useRouter();

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

            <SocialAuthButtons onAuthed={() => router.push(`${BASE}/home`)} />

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
