"use client";

import { toast } from "sonner";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

/**
 * Toasts are the app's only transient feedback surface. They are mounted once
 * per section (see `screens/layout.tsx`) rather than per page, so everything
 * here fires into that single Toaster.
 */
function Demos() {
  return (
    <div>
      <h1 className="type-h1 mb-8">Feedback</h1>

      <DsSection index="01" title="Toast">
        <p className="type-muted mb-4 max-w-prose">
          Position is responsive — <code className="type-code">top-center</code>{" "}
          below <code className="type-code">md</code>,{" "}
          <code className="type-code">bottom-right</code> above. Bottom is the
          desktop convention, but on a phone that corner already holds the tab
          bar and the mini player, so a toast there either covers the transport
          or is covered by it. Theme follows the html{" "}
          <code className="type-code">dark</code> class via a MutationObserver,
          so toasts flip with the app rather than the OS preference.
        </p>

        <StatePanel
          name="Toaster / toast()"
          signal="toast_shown"
          views={{
            default: (
              <Button
                variant="outline"
                onClick={() => toast("Added to Liked Songs")}
              >
                Show toast
              </Button>
            ),
            described: (
              <Button
                variant="outline"
                onClick={() =>
                  toast("Playlist created", {
                    description: "Rainy Tapes — 4 tracks",
                  })
                }
              >
                With description
              </Button>
            ),
            action: (
              <Button
                variant="outline"
                onClick={() =>
                  toast("Removed from playlist", {
                    action: { label: "Undo", onClick: () => toast("Restored") },
                  })
                }
              >
                With action
              </Button>
            ),
          }}
        />
      </DsSection>

      {/* This page fires toasts outside the screens layout, so it needs its
          own Toaster — the app mounts exactly one in screens/layout.tsx. */}
      <Toaster />
    </div>
  );
}

export default function FeedbackComponentsPage() {
  return (
    <MockStudioProvider>
      <Demos />
    </MockStudioProvider>
  );
}
