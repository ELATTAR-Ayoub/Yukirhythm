"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export interface NavTabItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavTabsProps {
  items: NavTabItem[];
  /** href of the active item (already matched against the pathname). */
  activeHref: string | null;
  /** Icons-only compact strip — labels become aria-labels. */
  iconsOnly?: boolean;
  className?: string;
}

/**
 * Link-based segmented tabs, styled like the shadcn Tabs list — the active-tab
 * background is a single pill that slides between items (spring easing) and
 * lands with a jelly squash. Same mechanics as components/ui/tabs.tsx, but for
 * navigation Links instead of Radix tab triggers.
 */
export default function NavTabs({
  items,
  activeHref,
  iconsOnly = false,
  className,
}: NavTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const jellyRef = useRef<HTMLSpanElement>(null);
  const firstMove = useRef(true);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const move = () => {
      const active = list.querySelector<HTMLElement>('[data-active="true"]');
      const ind = indicatorRef.current;
      const jelly = jellyRef.current;
      if (!ind) return;
      if (!active) {
        ind.style.opacity = "0";
        return;
      }
      ind.style.width = `${active.offsetWidth}px`;
      ind.style.transform = `translateX(${active.offsetLeft}px)`;
      ind.style.opacity = "1";
      if (firstMove.current) {
        // no travel animation on mount — just appear in place
        ind.style.transitionDuration = "0ms";
        requestAnimationFrame(() => {
          ind.style.transitionDuration = "";
        });
        firstMove.current = false;
        return;
      }
      if (jelly) {
        jelly.classList.remove("anim-jelly");
        void jelly.offsetWidth; // restart the squash
        jelly.classList.add("anim-jelly");
      }
    };

    move();
    const ro = new ResizeObserver(move);
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeHref]);

  return (
    <div
      ref={listRef}
      className={cn(
        // consumers supply the track bg (e.g. bg-muted, bg-muted/15)
        "relative flex items-stretch rounded-lg p-1 text-muted-foreground",
        iconsOnly && "p-1.5",
        className
      )}
    >
      <span
        ref={indicatorRef}
        aria-hidden
        className="absolute top-1 bottom-1 left-0 w-0 opacity-0 pointer-events-none transition-[transform,width] duration-base ease-spring motion-reduce:transition-none"
      >
        <span
          ref={jellyRef}
          className="block h-full w-full rounded-md bg-background shadow-chip"
        />
      </span>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={iconsOnly ? label : undefined}
            data-active={active || undefined}
            className={cn(
              "relative z-10 flex-1 flex flex-col items-center justify-center gap-1 rounded-md",
              iconsOnly ? "px-3 py-6" : "px-3 py-2",
              "font-label text-[10px] uppercase tracking-wider transition-colors duration-base",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              active ? "text-foreground" : "hover:text-foreground/80"
            )}
          >
            <Icon className="w-5 h-5" />
            {iconsOnly ? null : <span>{label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
