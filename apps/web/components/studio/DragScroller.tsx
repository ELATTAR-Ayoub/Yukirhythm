"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface DragScrollerProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Horizontal scroll surface with no visible scrollbar — grab-and-drag with the
 * pointer, or a plain vertical mouse wheel mapped onto the x axis. Touch keeps
 * the native momentum scroll; only mouse/pen get the drag handling.
 */
export default function DragScroller({
  children,
  className,
}: DragScrollerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let moved = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) {
        // past the slop threshold this is a drag, not a click
        el.setPointerCapture(e.pointerId);
        el.dataset.dragging = "true";
      }
      moved = Math.max(moved, Math.abs(dx));
      el.scrollLeft = startLeft - dx;
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.dragging;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    // swallow the click that ends a drag so cards don't navigate
    const onClick = (e: MouseEvent) => {
      if (moved > 3) {
        e.preventDefault();
        e.stopPropagation();
      }
      moved = 0;
    };

    const onWheel = (e: WheelEvent) => {
      // trackpads send deltaX themselves — only remap a pure vertical wheel
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = el.scrollLeft + e.deltaY;
      // let the page keep scrolling once the rail is at either end
      if (next < 0 || next > max) return;
      e.preventDefault();
      el.scrollLeft = next;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClick, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "no-scrollbar overflow-x-auto cursor-grab [&[data-dragging]]:cursor-grabbing",
        "[&[data-dragging]_*]:pointer-events-none [&[data-dragging]]:select-none",
        className
      )}
    >
      {children}
    </div>
  );
}
