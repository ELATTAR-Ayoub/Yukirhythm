"use client";

import { useMemo } from "react";
import { auth } from "@/config/firebase";
import { createBackendClient, type BackendClient } from "@/lib/api/backend";
import { activeGuestId } from "./guest-session";
import { createGuestBackend } from "./guest-backend";

/**
 * The backend client bound to the signed-in user's token. The token provider
 * reads the current Firebase user each call, so a fresh token is always used
 * and the client survives sign-in/out without being recreated.
 */
export function useBackend(expectedUid?: string): BackendClient {
  const guestId = expectedUid?.startsWith("guest-")
    ? expectedUid
    : !expectedUid
      ? activeGuestId()
      : null;
  return useMemo(
    () =>
      guestId
        ? createGuestBackend(guestId)
        : createBackendClient(async () => {
            const user = auth.currentUser;
            return user && (!expectedUid || user.uid === expectedUid)
              ? user.getIdToken()
              : null;
          }),
    [expectedUid, guestId]
  );
}
