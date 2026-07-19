import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { Toaster } from "@/components/ui/sonner";

/**
 * State (MockStudioProvider) and toasts stay here so they persist across the
 * whole `/design-system/screens` section. The centred `max-w-6xl mx-auto p-2
 * sm:p-6` column that used to live here moved to `ScreensFrame` — the `(app)`
 * route group needs its own full-viewport grid instead, and this layout
 * wraps both. See `components/studio/screens/ScreensFrame.tsx`.
 */
export default function ScreensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MockStudioProvider>
      {children}
      <Toaster />
    </MockStudioProvider>
  );
}
