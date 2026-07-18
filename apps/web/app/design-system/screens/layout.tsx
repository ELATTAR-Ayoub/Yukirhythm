import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { Toaster } from "@/components/ui/sonner";

export default function ScreensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MockStudioProvider>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </div>
      <Toaster />
    </MockStudioProvider>
  );
}
