import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yukirhythm — Design System",
  description:
    "Studio palette, typography, tokens and the living component inventory of Yukirhythm.",
};

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
