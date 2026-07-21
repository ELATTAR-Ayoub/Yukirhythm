import { Toaster } from "sonner";
import StudioProvider from "@/components/studio/StudioProvider";

/**
 * Sign-in is a standalone full-viewport screen — no rails, header or playback
 * bar. It sits outside the (studio) shell so its 100vh aurora fills the page
 * instead of overflowing the shell's scrolling column. It still needs the
 * studio context for signIn.
 */
export default function AuthLayout({
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
