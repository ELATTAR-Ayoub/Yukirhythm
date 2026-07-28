"use client";

import { Toaster } from "sonner";

import StudioProvider from "@/components/studio/StudioProvider";
import StudioShellSkeleton from "@/components/studio/shell/StudioShellSkeleton";
import StudioShell from "@/components/studio/shell/StudioShell";
import AuthGate from "@/components/studio/shell/AuthGate";

/**
 * The authenticated app uses the shared studio shell on the real backend.
 * AuthGate stays outside StudioProvider so signed-out visitors do not fetch
 * private app data.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate fallback={<StudioShellSkeleton />}>
      {(authenticatedUser) => (
        <StudioProvider authenticatedUser={authenticatedUser}>
          <StudioShell>{children}</StudioShell>
          <Toaster />
        </StudioProvider>
      )}
    </AuthGate>
  );
}
