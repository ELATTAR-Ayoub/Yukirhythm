import Link from "next/link";
import { cn } from "@/lib/utils";
import SectionLabel from "@/components/studio/SectionLabel";

interface RailShelfProps {
  label: string;
  title: string;
  seeAllHref?: string;
  children: React.ReactNode;
  className?: string;
  /** Signal: shelf_scroll, shelf_see_all */
}

/** Horizontal scroller shelf — "Recently played", "New releases", etc. */
export default function RailShelf({
  label,
  title,
  seeAllHref,
  children,
  className,
}: RailShelfProps) {
  return (
    <section className={cn("w-full", className)} data-signal="shelf_scroll">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <SectionLabel>{label}</SectionLabel>
          <h2 className="font-display font-bold text-2xl tracking-tight mt-0.5">
            {title}
          </h2>
        </div>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="font-label text-[11px] uppercase tracking-wider text-primary hover:underline shrink-0 pb-1"
            data-signal="shelf_see_all"
          >
            See all →
          </Link>
        ) : null}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
        {children}
      </div>
    </section>
  );
}
