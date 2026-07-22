"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthState } from "@/lib/studio/useAuth";
import { useBackend } from "@/lib/studio/useBackend";
import { HOME, QUEUE } from "@/components/studio/shell/routes";

/**
 * The app root is the player. Where it opens depends on whether this user has
 * ever listened to anything.
 *
 * A brand-new account lands on the queue: it is empty, its "+" is the one
 * control that does something useful on a cold account, and sending them to
 * Home instead offers rails that have nothing personal in them yet. Anyone
 * with a queue or a saved track goes to Home, which is what they expect.
 *
 * Client-side because that decision needs the user's playback document, which
 * a server redirect cannot read without their token.
 */
export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuthState();
  const backend = useBackend();

  useEffect(() => {
    // `loading` is true until Firebase's first emit. Treating "not yet known"
    // as signed out would send every returning user to Home on a cold load,
    // ahead of the real answer — wait for auth to settle instead.
    if (loading) return;

    let live = true;

    // Signed out there is no history by definition, and the queue screen would
    // only offer a disabled field.
    if (!user) {
      router.replace(HOME);
      return;
    }

    void backend.me.playback.get().then(
      (state) => {
        if (!live) return;
        const cold = !state?.trackId && (state?.queue?.length ?? 0) === 0;
        router.replace(cold ? QUEUE : HOME);
      },
      () => {
        // A failed read must not redefine where the app opens.
        if (live) router.replace(HOME);
      }
    );

    return () => {
      live = false;
    };
  }, [user, loading, backend, router]);

  // The shell's own loading state covers the decision, so there is no flash of
  // a page the user is about to be moved off.
  return null;
}
