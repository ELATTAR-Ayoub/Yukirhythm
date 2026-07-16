import type { Metadata } from "next";
import Link from "next/link";
import ThemeFlip from "@/components/studio/ds/ThemeFlip";

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
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-display font-semibold tracking-tight">
              Yukirhythm
            </Link>
            <span className="font-label text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Design System
            </span>
          </div>
          <nav className="flex items-center gap-1 font-ui text-sm">
            <Link
              href="/design-system"
              className="px-3 py-1.5 rounded-md hover:bg-secondary transition-colors duration-fast"
            >
              Foundations
            </Link>
            <Link
              href="/design-system/components"
              className="px-3 py-1.5 rounded-md hover:bg-secondary transition-colors duration-fast"
            >
              Components
            </Link>
            <div className="ml-2">
              <ThemeFlip />
            </div>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
