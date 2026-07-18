import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { Toaster } from "@/components/ui/sonner";

export default function ScreensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MockStudioProvider>
      {/* top spacing always equals edge spacing — 8px on small screens */}
      <div className="relative max-w-6xl mx-auto p-2 sm:p-6">
        {children}
      </div>
      <Toaster />
    </MockStudioProvider>
  );
}
