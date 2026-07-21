"use client";

import { useState } from "react";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { devSignIn } from "@/lib/studio/useAuth";
import { formatDuration } from "@/components/studio/screens/mock-data";

/**
 * A deliberately plain page that drives the REAL provider so the phase-8
 * pipeline can be verified in the browser: sign in, search live YouTube, play a
 * real track, like it. Not a designed screen — that is the full migration.
 */
export default function LivePage() {
  const s = useMockStudio();
  const [q, setQ] = useState("");

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui", padding: 16 }}>
      <h1 data-testid="live-title">Live — real backend</h1>

      <section style={{ margin: "16px 0" }}>
        {s.user ? (
          <div data-testid="signed-in">
            Signed in as <b>{s.user.userName}</b> ({s.user.email}) ·{" "}
            <button onClick={() => s.signOut()}>Sign out</button>
          </div>
        ) : (
          <button
            data-testid="dev-signin"
            onClick={() => devSignIn(`live-${Date.now()}@example.com`, "password123")}
          >
            Dev sign in (emulator)
          </button>
        )}
      </section>

      <section style={{ margin: "16px 0" }}>
        <input
          data-testid="search"
          value={q}
          placeholder="Search songs…"
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim()) s.search(e.target.value);
            else s.clearSearch();
          }}
          style={{ width: "100%", padding: 8, fontSize: 16 }}
        />
        {s.searching && <p>Searching…</p>}
        <ul data-testid="results" style={{ listStyle: "none", padding: 0 }}>
          {s.searchResults.map((t) => (
            <li key={t.id} style={{ display: "flex", gap: 8, padding: "6px 0" }}>
              <button data-testid={`play-${t.id}`} onClick={() => s.play(t)}>
                ▶
              </button>
              <span style={{ flex: 1 }}>
                {t.title} — {t.artist} ({formatDuration(t.durationSec)})
              </span>
              <button onClick={() => s.toggleLike(t.id)}>
                {s.isLiked(t.id) ? "♥" : "♡"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {s.nowPlaying && (
        <section
          data-testid="now-playing"
          style={{ position: "sticky", bottom: 0, background: "#111", color: "#fff", padding: 12, borderRadius: 8 }}
        >
          {s.isLoading ? "Loading… " : s.isPlaying ? "▶ " : "❚❚ "}
          <b>{s.nowPlaying.title}</b> — {s.nowPlaying.artist} ·{" "}
          <span data-testid="progress">{formatDuration(s.progressSec)}</span> /{" "}
          {formatDuration(s.nowPlaying.durationSec)}{" "}
          <button onClick={() => s.toggle()}>{s.isPlaying ? "Pause" : "Play"}</button>{" "}
          <button onClick={() => s.next()}>Next ⏭</button>
        </section>
      )}
    </main>
  );
}
