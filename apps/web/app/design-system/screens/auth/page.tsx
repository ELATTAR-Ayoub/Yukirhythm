"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { AuroraBackground } from "@/components/ui/aurora-background";
import SocialAuthButtons from "@/components/studio/screens/SocialAuthButtons";

const BASE = "/design-system/screens";

/** One door for everyone — Firebase social sign-in creates accounts on first login. */
export default function AuthScreen() {
  const router = useRouter();

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <AuroraBackground className="!w-full !h-[72vh] p-6">
        <div className="relative w-full sm:max-w-[400px] flex flex-col items-center gap-4">
          <Image
            src="/svgs/logo_light.svg"
            width={24}
            height={24}
            alt="Yukirhythm"
            className="h-6 w-auto object-contain"
          />
          <h1 className="type-h2 text-center anim-sign-on">
            Listen your way
          </h1>
          <p className="type-small text-center text-muted-foreground">
            One account for everything — sign in or sign up in a single tap.
          </p>

          <SocialAuthButtons onAuthed={() => router.push(`${BASE}/home`)} />

          <p className="type-small text-muted-foreground text-center">
            By continuing you agree to the mock Terms — nothing here touches the
            network.
          </p>
        </div>
      </AuroraBackground>
    </div>
  );
}
