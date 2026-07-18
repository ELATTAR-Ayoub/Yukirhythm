"use client";

import YukiAgent, { YukiAgentState } from "@/components/agent/YukiAgent";

const STATES: { state: YukiAgentState; note: string }[] = [
  { state: "idle", note: "waiting — slow breathing glow" },
  { state: "idle-b", note: "drifting horizon" },
  { state: "listening", note: "user speaking — reactive rings" },
  { state: "thinking", note: "reasoning — marble churn" },
  { state: "responding", note: "streaming answer — wave rows" },
  { state: "done", note: "settled — single soft pulse" },
  { state: "searching", note: "finding music — radar sweep" },
  { state: "downloading", note: "installing track — fill + streams" },
  { state: "playing", note: "now playing — live EQ" },
  { state: "scanning", note: "indexing library — grid sweep" },
  { state: "playlist", note: "building queue — stacking tracks" },
  { state: "syncing", note: "pushing to device — orbit pair" },
  { state: "recommending", note: "suggestions — plasma glints" },
  { state: "asking", note: "needs a choice — blinking ?" },
  { state: "success", note: "track added — mint burst" },
  { state: "error", note: "failed — glitch static" },
  { state: "sleeping", note: "inactive — drifting z" },
];

/** Live gallery of every <yuki-agent> state, for the design-system page. */
export default function AgentGallery() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
      {STATES.map(({ state, note }) => (
        <div key={state} className="flex flex-col gap-2">
          <div className="rounded-lg overflow-hidden border border-border aspect-square bg-ink">
            <YukiAgent state={state} className="w-full h-full block" />
          </div>
          <div>
            <div className="font-label text-xs text-primary">{state}</div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              {note}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
