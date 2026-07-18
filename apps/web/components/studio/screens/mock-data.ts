import type { TextureName } from "@/components/studio/Texture";

/**
 * Mock catalogue for the /design-system/screens previews.
 * Nothing here touches Firebase, YouTube or the app's real stores — it exists
 * purely so the reskinned pages can be judged with realistic data and flow.
 */

export interface MockTrack {
  id: string;
  title: string;
  artist: string;
  texture: TextureName;
  durationSec: number;
}

export interface MockCollection {
  id: string;
  title: string;
  desc: string;
  texture: TextureName;
  trackIds: string[];
  likes: number;
  tags: string[];
}

export interface MockUser {
  id: string;
  userName: string;
  email: string;
  initials: string;
  followers: number;
  following: number;
}

/** m:ss, or h:mm:ss past an hour — always fed through DataText (OffBit). */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const MOCK_TRACKS: MockTrack[] = [
  { id: "t1", title: "Midnight Snowfall", artist: "Yuki Sato", texture: "tx-k2-vinyl", durationSec: 214 },
  { id: "t2", title: "Cobalt Dreams", artist: "Aoi Waves", texture: "tx-k-marble", durationSec: 188 },
  { id: "t3", title: "Static Bloom", artist: "Mint Circuit", texture: "tx-k2-static", durationSec: 262 },
  { id: "t4", title: "Paper Lanterns", artist: "Rei Kurosawa", texture: "tx-k-silk", durationSec: 201 },
  { id: "t5", title: "Topographic Heart", artist: "Nori", texture: "tx-k2-topo", durationSec: 176 },
  { id: "t6", title: "Ripple Theory", artist: "Aoi Waves", texture: "tx-k-ripple", durationSec: 233 },
  { id: "t7", title: "Glitch Sakura", artist: "Mint Circuit", texture: "tx-k-glitch", durationSec: 197 },
  { id: "t8", title: "Horizon Line", artist: "Yuki Sato", texture: "tx-k2-horizon", durationSec: 288 },
  { id: "t9", title: "Checker Room", artist: "8-Bit Monk", texture: "tx-k2-checker", durationSec: 154 },
  { id: "t10", title: "ASCII Rain", artist: "Nori", texture: "tx-k-ascii-ripple", durationSec: 245 },
  { id: "t11", title: "Dense Marble", artist: "Rei Kurosawa", texture: "tx-k2-marble-dense", durationSec: 219 },
  { id: "t12", title: "Equalizer Sunday", artist: "8-Bit Monk", texture: "tx-k2-ascii-eq", durationSec: 208 },
];

export const MOCK_COLLECTIONS: MockCollection[] = [
  { id: "c1", title: "Late Study Lo-Fi", desc: "Quiet loops for deep focus.", texture: "tx-k2-topo", trackIds: ["t1", "t4", "t10", "t5"], likes: 1284, tags: ["lofi", "focus"] },
  { id: "c2", title: "Cobalt After Hours", desc: "Neon-lit night drive.", texture: "tx-k-marble", trackIds: ["t2", "t6", "t8"], likes: 842, tags: ["chill", "night"] },
  { id: "c3", title: "Pixel Podcasts", desc: "Long-form talks, dithered.", texture: "tx-k2-static", trackIds: ["t3", "t12"], likes: 511, tags: ["podcast"] },
  { id: "c4", title: "Mint Mornings", desc: "Bright starts, soft beats.", texture: "tx-k-silk", trackIds: ["t7", "t9", "t11"], likes: 967, tags: ["morning", "chill"] },
  { id: "c5", title: "Static & Snow", desc: "Ambient textures.", texture: "tx-k2-marble-dense", trackIds: ["t5", "t10", "t3", "t1"], likes: 388, tags: ["ambient"] },
  { id: "c6", title: "Retro Arcade", desc: "8-bit nostalgia set.", texture: "tx-k2-checker", trackIds: ["t9", "t12"], likes: 1533, tags: ["retro", "game"] },
];

export const MOCK_USER: MockUser = {
  id: "u1",
  userName: "Yuki Sato",
  email: "yuki@yukirhythm.app",
  initials: "YS",
  followers: 1240,
  following: 318,
};

export function searchMockTracks(query: string): MockTrack[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return MOCK_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  );
}
