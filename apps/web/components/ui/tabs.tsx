"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

// The active-tab background is a single pill that physically slides between
// triggers (spring easing) and lands with a jelly squash.
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const indicatorRef = React.useRef<HTMLSpanElement>(null);
  const jellyRef = React.useRef<HTMLSpanElement>(null);
  const firstMove = React.useRef(true);

  const setRefs = (node: HTMLDivElement | null) => {
    listRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const move = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      const ind = indicatorRef.current;
      const jelly = jellyRef.current;
      if (!active || !ind) return;
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
    const mo = new MutationObserver(move);
    mo.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    });
    const ro = new ResizeObserver(move);
    ro.observe(list);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "relative inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    >
      <span
        ref={indicatorRef}
        aria-hidden
        className="absolute top-1 bottom-1 left-0 w-0 opacity-0 pointer-events-none transition-[transform,width] duration-base ease-spring"
      >
        <span
          ref={jellyRef}
          className="block h-full w-full rounded-md bg-background shadow-chip"
        />
      </span>
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-colors duration-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
