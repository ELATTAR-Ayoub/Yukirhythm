import Link from "next/link";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
