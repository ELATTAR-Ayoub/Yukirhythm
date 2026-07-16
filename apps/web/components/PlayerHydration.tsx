"use client";

import { useEffect } from "react";

import { hydratePlayer } from "@/store/player";

/**
 * Rehydrates the persisted player queue after mount. Rendering nothing keeps
 * the server output free of client-only state, avoiding hydration mismatch.
 */
export default function PlayerHydration() {
  useEffect(() => {
    void hydratePlayer();
  }, []);

  return null;
}
