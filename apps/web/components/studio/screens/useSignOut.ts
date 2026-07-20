"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AUTH } from "@/components/studio/shell/routes";
import { useMockStudio } from "./MockStudioProvider";

/**
 * The single sign-out path. The two entry points used to disagree: Settings
 * cleared the session, confirmed, and redirected, while the header dropdown
 * did none of the last two and left the user on a page that silently became
 * its signed-out state.
 */
export function useSignOut(): () => void {
  const { signOut } = useMockStudio();
  const router = useRouter();

  return useCallback(() => {
    signOut();
    toast("Signed out");
    router.push(AUTH);
  }, [signOut, router]);
}
