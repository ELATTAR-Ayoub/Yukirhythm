"use client";

import { Toaster } from "@/components/ui/sonner";
import NowPlayingBar from "./NowPlayingBar";
import PreviewMenu from "./PreviewMenu";

/** Shared global chrome for every screen preview: player bar + floating menu + toasts. */
export default function PreviewChrome() {
  return (
    <>
      <NowPlayingBar />
      <PreviewMenu />
      <Toaster />
    </>
  );
}
