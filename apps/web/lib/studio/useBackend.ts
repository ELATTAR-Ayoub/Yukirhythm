"use client";

import { useMemo } from "react";
import { auth } from "@/config/firebase";
import { createBackendClient, type BackendClient } from "@/lib/api/backend";

/**
 * The backend client bound to the signed-in user's token. The token provider
 * reads the current Firebase user each call, so a fresh token is always used
 * and the client survives sign-in/out without being recreated.
 */
export function useBackend(): BackendClient {
  return useMemo(
    () =>
      createBackendClient(async () => {
        const user = auth.currentUser;
        return user ? user.getIdToken() : null;
      }),
    []
  );
}
