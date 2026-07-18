import Link from "next/link";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SectionLabel from "@/components/studio/SectionLabel";
import { SkeletonCard } from "@/components/studio/Skeletons";

interface RailShelfProps {
  label: string;
  title: string;
  seeAllHref?: string;
  /** Skeletons everything — header, see-all and cards. */
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
  /** Signal: shelf_scroll, shelf_see_all */
}

/** Horizontal scroller shelf — "Recently played", "New releases", etc. */
export default function RailShelf({
  label,
  title,
  seeAllHref,
  loading = false,
  children,
  className,
}: RailShelfProps) {
  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-busy>
        <div className="flex items-end justify-between gap-4 mb-3 animate-pulse">
          <div>
            <div className="h-2.5 w-24 bg-muted rounded-sm" />
            <div className="h-6 w-48 bg-muted rounded-sm mt-2" />
          </div>
          <div className="h-7 w-20 bg-muted rounded-full" />
        </div>
        <div className="flex gap-4 overflow-hidden pb-3 -mx-1 px-1">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} className="w-36" />
          ))}
        </div>
      </section>
    );
  }
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
          <Button variant="ghost" size="sm" asChild className="shrink-0">
            <Link href={seeAllHref} data-signal="shelf_see_all">
              See all
              <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
        {children}
      </div>
    </section>
  );
}
