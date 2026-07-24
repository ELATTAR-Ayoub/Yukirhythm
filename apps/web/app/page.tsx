"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthState } from "@/lib/studio/useAuth";
import { useBackend } from "@/lib/studio/useBackend";
import { AUTH, HOME, SEARCH } from "@/components/studio/shell/routes";

/**
 * The app root is the player. Where it opens depends on whether this user is
 * signed in, and if so, whether they have ever listened to anything.
 *
 * A brand-new account lands on Search: the feeds and the search field are
 * the controls that do something useful on a cold account, where Home's
 * rails would have nothing personal in them yet. Anyone with a queue or a
 * saved track goes to Home, which is what they expect. Signed-out visitors
 * land on the login page.
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
    // as signed out would send every returning user to the login page on a
    // cold load, ahead of the real answer — wait for auth to settle instead.
    if (loading) return;

    let live = true;

    // Signed out means the login gate, full stop.
    if (!user) {
      router.replace(AUTH);
      return;
    }

    void backend.me.playback.get().then(
      (state) => {
        if (!live) return;
        const cold = !state?.trackId && (state?.queue?.length ?? 0) === 0;
        router.replace(cold ? SEARCH : HOME);
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
