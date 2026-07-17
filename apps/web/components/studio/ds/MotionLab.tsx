"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PlayIcon } from "@radix-ui/react-icons";

/** Tile that re-mounts its child on click so the animation replays. */
function ReplayTile({
  name,
  recipe,
  usage,
  children,
  clickHint = "CLICK TO REPLAY",
}: {
  name: string;
  recipe: string;
  usage: string;
  children: React.ReactNode;
  clickHint?: string;
}) {
  const [run, setRun] = useState(0);

  return (
    <button
      onClick={() => setRun((r) => r + 1)}
      className="text-left rounded-lg border border-border bg-card overflow-hidden group"
    >
      <div className="h-36 flex items-center justify-center bg-background border-b border-border relative overflow-hidden">
        <span key={run} className="inline-flex">
          {children}
        </span>
        <span className="type-label text-muted-foreground absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
          {clickHint}
        </span>
      </div>
      <div className="p-4">
        <div className="type-h4">{name}</div>
        <div className="type-code inline-block mt-2">{recipe}</div>
        <p className="type-muted mt-2">{usage}</p>
      </div>
    </button>
  );
}

const box = "w-16 h-16 rounded-lg bg-cobalt shadow-e2";

/** Interactive motion demos — springy group + machine group. */
export default function MotionLab() {
  return (
    <div className="grid gap-10">
      {/* springy */}
      <div>
        <div className="type-label text-primary mb-4">
          SPRINGY — ELASTIC, OVERSHOOTS, SETTLES. FOR EVERYTHING FUN.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <ReplayTile
            name="Jelly pop"
            recipe=".anim-pop-in"
            usage="Cards, dialogs, agent replies — grows from 25%, lands with a jelly wobble."
          >
            <span className={cn(box, "anim-pop-in")} />
          </ReplayTile>
          <ReplayTile
            name="Spring up"
            recipe=".anim-spring-up"
            usage="Toasts, the now-playing bar — a slow, soft rise that settles gently."
          >
            <span className={cn(box, "anim-spring-up")} />
          </ReplayTile>
          <ReplayTile
            name="Jelly"
            recipe=".anim-jelly"
            usage="Like button, add-to-playlist — reward taps with a wobble."
          >
            <span className={cn(box, "anim-jelly rounded-full bg-mint")} />
          </ReplayTile>
          <ReplayTile
            name="Click spring (global)"
            recipe=".click-spring"
            usage="THE default click feel — slap it on anything clickable: avatars, chips, badges, tiles."
            clickHint="PRESS & HOLD"
          >
            <span className="click-spring inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary main_shadow cursor-pointer">
              <span className="type-data-md">42</span>
            </span>
          </ReplayTile>
          <ReplayTile
            name="Spring press"
            recipe=".press-spring"
            usage="Press: instant squish (40ms), release springs back in 220ms."
            clickHint="PRESS & HOLD"
          >
            <span
              className={cn(
                box,
                "press-spring inline-flex items-center justify-center cursor-pointer"
              )}
            >
              <PlayIcon className="w-6 h-6 text-snow" />
            </span>
          </ReplayTile>
        </div>
      </div>

      {/* machine */}
      <div>
        <div className="type-label text-primary mb-4">
          MACHINE — STEPPED, PHYSICAL, NO IN-BETWEENS. FOR THE DEVICE FEEL.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ReplayTile
            name="Key press"
            recipe=".press-key"
            usage="Transport buttons — real key travel into the socket, 80ms, no easing."
            clickHint="PRESS & HOLD"
          >
            <span className="press-key inline-flex items-center justify-center w-16 h-14 rounded-md bg-card border border-border cursor-pointer">
              <PlayIcon className="w-5 h-5" />
            </span>
          </ReplayTile>
          <ReplayTile
            name="Ratchet"
            recipe=".anim-ratchet"
            usage="Loading discs, syncing — rotates in 8 mechanical clicks, never smooth."
          >
            <span className="anim-ratchet inline-flex w-16 h-16 rounded-full bg-ink items-center justify-center">
              <span className="w-1.5 h-6 bg-mint rounded-sm -translate-y-2.5" />
            </span>
          </ReplayTile>
          <ReplayTile
            name="Sign on"
            recipe=".anim-sign-on"
            usage="Text turning on like a neon sign — buzzes, then holds a glow. Text only, never boxes."
          >
            <span className="inline-flex w-28 h-16 rounded-md bg-ink items-center justify-center">
              <span className="anim-sign-on type-label text-mint">ON AIR</span>
            </span>
          </ReplayTile>
        </div>
      </div>

      {/* the law */}
      <div className="rounded-lg border border-border bg-card p-5 max-w-2xl">
        <div className="type-large">When to use which</div>
        <p className="type-p mt-2">
          <b>Springy</b> = things that appear, react, or reward (cards, likes,
          toasts, the agent). <b>Machine</b> = things you operate (transport
          keys, toggles, loaders). Content bounces; controls click.
        </p>
      </div>
    </div>
  );
}
