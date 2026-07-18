import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import PreviewChrome from "@/components/studio/screens/PreviewChrome";

export default function ScreensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MockStudioProvider>
      <div className="relative pb-28">{children}</div>
      <PreviewChrome />
    </MockStudioProvider>
  );
}
