"use client";

import { useEffect, useState } from "react";

// States implemented by public/yuki-agent.js (owner-supplied web component).
export type YukiAgentState =
  | "idle"
  | "idle-b"
  | "listening"
  | "thinking"
  | "responding"
  | "done"
  | "done-b"
  | "searching"
  | "downloading"
  | "playing"
  | "scanning"
  | "playlist"
  | "playlist-b"
  | "syncing"
  | "recommending"
  | "recommending-b"
  | "asking"
  | "asking-b"
  | "success"
  | "success-b"
  | "error"
  | "error-b"
  | "sleeping"
  | "sleeping-b";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "yuki-agent": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        state?: YukiAgentState;
        speed?: number | string;
        /** Custom elements need the literal class attribute — className is NOT mapped */
        class?: string;
      };
    }
  }
}

let loader: Promise<void> | null = null;

function loadAgentScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.customElements?.get("yuki-agent")) return Promise.resolve();
  if (!loader) {
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/yuki-agent.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loader = null;
        reject(new Error("Failed to load /yuki-agent.js"));
      };
      document.head.appendChild(script);
    });
  }
  return loader;
}

interface YukiAgentProps {
  state?: YukiAgentState;
  /** Animation speed multiplier, defaults to 1 */
  speed?: number;
  className?: string;
}

/**
 * React wrapper around the <yuki-agent> canvas web component.
 * Dithered agent avatar in the Studio palette; swap `state` live.
 */
export default function YukiAgent({
  state = "idle",
  speed = 1,
  className,
}: YukiAgentProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadAgentScript()
      .then(() => mounted && setReady(true))
      .catch(() => mounted && setReady(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    // Reserve the box so layout doesn't jump while the script loads.
    return <div className={className} aria-hidden data-yuki-agent-loading />;
  }

  return (
    <yuki-agent
      state={state}
      speed={speed}
      class={className}
      role="img"
      aria-label={`Yuki agent — ${state}`}
    />
  );
}
