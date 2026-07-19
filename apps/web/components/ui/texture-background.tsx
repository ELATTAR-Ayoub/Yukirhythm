"use client";

import React, { ReactNode } from "react";

import { cn } from "@/lib/utils";
import AnimatedTexture, {
  type AnimatedTextureKind,
} from "@/components/studio/AnimatedTexture";

interface TextureBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  /** Which live branding texture backs the page. */
  texture?: AnimatedTextureKind;
  /** Feathered edges — off only if the parent already clips to a shape. */
  feather?: boolean;
}

/**
 * Full-bleed branding backdrop. Replaces the old aurora gradient with a texture
 * from the studio pack, centred on the page and a full viewport tall.
 *
 * The layer keeps the aurora's 10px bleed so it never reveals a seam at the
 * edge, and is masked with a radial fade so it dissolves into the background
 * instead of stopping on a hard rectangle.
 */
export const TextureBackground = ({
  className,
  children,
  texture = "marble",
  feather = true,
  ...props
}: TextureBackgroundProps) => {
  return (
    <main>
      <div
        className={cn(
          "relative flex flex-col w-screen h-[100vh] items-center justify-center",
          "bg-background text-primary transition-bg",
          className
        )}
        {...props}
      >
        {/* The feather lives on the clipping wrapper, not the texture, so the
            fade always lands on the container's edge — a container shorter
            than 100vh would otherwise crop the texture before it fades. */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 overflow-hidden pointer-events-none",
            feather &&
              "[mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_78%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_78%)]"
          )}
        >
          <AnimatedTexture
            kind={texture}
            speed={0.5}
            className={cn(
              // centred on the page, a full viewport tall, keeping the -10px bleed
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[calc(100%+20px)] h-[calc(100vh+20px)]",
              "opacity-60 dark:opacity-40"
            )}
          />
        </div>
        {children}
      </div>
    </main>
  );
};
