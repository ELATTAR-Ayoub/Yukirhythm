import { Toaster } from "sonner";
import StudioProvider from "@/components/studio/StudioProvider";

/**
 * Phase 8 verification surface: the real StudioProvider (backend-backed) around
 * a live slice of the app. Proves auth → real data → real playback in the
 * browser before the full screen migration.
 */
export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudioProvider>
      {children}
      <Toaster />
    </StudioProvider>
  );
}
