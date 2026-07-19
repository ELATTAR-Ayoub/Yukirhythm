"use client";

import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface FadeScrollAreaProps {
  children: React.ReactNode;
  /** Tailwind max-height class for the scroll window. */
  maxHeight?: string;
  className?: string;
}

const FADE = 24; // px of dissolve at each edge

/**
 * Vertical scroll window whose content dissolves at the top and bottom edges
 * instead of ending on a hard cut. The fade is a mask, so it works over any
 * backdrop — a gradient overlay would have to match the surface behind it.
 *
 * Each edge only fades once there's content past it, so a short list sits
 * flush and a scrolled-to-top list keeps its first row crisp.
 *
 * The mask is written straight to the node instead of held in state: this runs
 * on every scroll frame, and routing it through a re-render left the edges a
 * step behind the actual scroll position.
 */
export default function FadeScrollArea({
  children,
  maxHeight = "max-h-[55vh]",
  className,
}: FadeScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Runs directly on every scroll/resize rather than being coalesced into a
  // frame: rAF batching dropped the newest scroll position, which left an edge
  // showing the previous frame's state.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflows = scrollHeight > clientHeight + 1;
    const top = overflows && scrollTop > 1 ? FADE : 0;
    const bottom =
      overflows && scrollTop + clientHeight < scrollHeight - 1 ? FADE : 0;
    const mask = `linear-gradient(to bottom, transparent 0, #000 ${top}px, #000 calc(100% - ${bottom}px), transparent 100%)`;
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // sort, filter or add changes the content height — re-measure for those too
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  return (
    <div
      ref={ref}
      className={cn(
        "no-scrollbar overflow-y-auto overscroll-contain",
        maxHeight,
        className
      )}
    >
      {children}
    </div>
  );
}
