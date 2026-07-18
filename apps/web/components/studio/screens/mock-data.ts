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

export type CollectionKind = "music" | "podcast";

export interface MockCollection {
  id: string;
  title: string;
  desc: string;
  texture: TextureName;
  trackIds: string[];
  likes: number;
  tags: string[];
  kind: CollectionKind;
  pinned: boolean;
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
  { id: "c1", title: "Late Study Lo-Fi", desc: "Quiet loops for deep focus.", texture: "tx-k2-topo", trackIds: ["t1", "t4", "t10", "t5"], likes: 1284, tags: ["lofi", "focus"], kind: "music", pinned: false },
  { id: "c2", title: "Cobalt After Hours", desc: "Neon-lit night drive.", texture: "tx-k-marble", trackIds: ["t2", "t6", "t8"], likes: 842, tags: ["chill", "night"], kind: "music", pinned: false },
  { id: "c3", title: "Pixel Podcasts", desc: "Long-form talks, dithered.", texture: "tx-k2-static", trackIds: ["t3", "t12"], likes: 511, tags: ["podcast"], kind: "podcast", pinned: false },
  { id: "c4", title: "Mint Mornings", desc: "Bright starts, soft beats.", texture: "tx-k-silk", trackIds: ["t7", "t9", "t11"], likes: 967, tags: ["morning", "chill"], kind: "music", pinned: false },
  { id: "c5", title: "Static & Snow", desc: "Ambient textures.", texture: "tx-k2-marble-dense", trackIds: ["t5", "t10", "t3", "t1"], likes: 388, tags: ["ambient"], kind: "music", pinned: false },
  { id: "c6", title: "Retro Arcade", desc: "8-bit nostalgia set.", texture: "tx-k2-checker", trackIds: ["t9", "t12"], likes: 1533, tags: ["retro", "game"], kind: "music", pinned: false },
  { id: "c7", title: "Night Static Radio", desc: "Late-night talk, tape hiss included.", texture: "tx-k2-ascii-eq", trackIds: ["t12", "t3", "t10"], likes: 204, tags: ["podcast", "night"], kind: "podcast", pinned: false },
];

export const MOCK_USER: MockUser = {
  id: "u1",
  userName: "Yuki Sato",
  email: "yuki@yukirhythm.app",
  initials: "YS",
  followers: 1240,
  following: 318,
};

export const LIKED_SONGS_ID = "liked";

/** Every user has this; pinned by default and surfaced first in the Library. */
export const LIKED_SONGS: MockCollection = {
  id: LIKED_SONGS_ID,
  title: "Liked Songs",
  desc: "Every track you've hearted.",
  texture: "tx-k-ripple",
  trackIds: ["t2", "t5", "t7", "t10", "t8"],
  likes: 0,
  tags: ["liked"],
  kind: "music",
  pinned: true,
};

export type HistoryGroup = "Today" | "Yesterday" | "This week";
export const HISTORY_GROUPS: HistoryGroup[] = ["Today", "Yesterday", "This week"];

export interface MockHistoryEntry {
  trackId: string;
  collectionId: string;
  group: HistoryGroup;
  timeLabel: string;
}

/** Static, deterministic listening history (newest first). */
export const MOCK_HISTORY: MockHistoryEntry[] = [
  { trackId: "t2", collectionId: "c2", group: "Today", timeLabel: "09:12" },
  { trackId: "t1", collectionId: "c1", group: "Today", timeLabel: "08:47" },
  { trackId: "t5", collectionId: LIKED_SONGS_ID, group: "Today", timeLabel: "08:02" },
  { trackId: "t3", collectionId: "c3", group: "Yesterday", timeLabel: "22:30" },
  { trackId: "t6", collectionId: "c2", group: "Yesterday", timeLabel: "18:15" },
  { trackId: "t7", collectionId: "c4", group: "Yesterday", timeLabel: "07:58" },
  { trackId: "t9", collectionId: "c6", group: "This week", timeLabel: "Tue" },
  { trackId: "t10", collectionId: "c5", group: "This week", timeLabel: "Tue" },
  { trackId: "t12", collectionId: "c7", group: "This week", timeLabel: "Mon" },
  { trackId: "t4", collectionId: "c1", group: "This week", timeLabel: "Mon" },
];

export interface MockStats {
  minutesWeek: number;
  minutesMonth: number;
  minutesAllTime: number;
  streakDays: number;
  topArtists: { name: string; plays: number }[];
  topTrackIds: string[];
  genreSplit: { name: string; pct: number }[];
  /** 24 values, 0..1 — relative listening intensity per hour. */
  byHour: number[];
}

export const MOCK_STATS: MockStats = {
  minutesWeek: 312,
  minutesMonth: 1489,
  minutesAllTime: 21437,
  streakDays: 9,
  topArtists: [
    { name: "Aoi Waves", plays: 84 },
    { name: "Yuki Sato", plays: 71 },
    { name: "Mint Circuit", plays: 56 },
    { name: "Nori", plays: 39 },
    { name: "8-Bit Monk", plays: 24 },
  ],
  topTrackIds: ["t2", "t8", "t1", "t7", "t10"],
  genreSplit: [
    { name: "Lo-fi", pct: 38 },
    { name: "Ambient", pct: 27 },
    { name: "Podcast", pct: 19 },
    { name: "Retro", pct: 16 },
  ],
  byHour: [0.05, 0.02, 0.01, 0.01, 0.02, 0.06, 0.2, 0.55, 0.7, 0.5, 0.35, 0.3, 0.4, 0.35, 0.3, 0.35, 0.45, 0.6, 0.8, 1, 0.9, 0.65, 0.35, 0.15],
};

export const NEW_RELEASE_IDS = ["t12", "t7", "t3", "t9", "t11", "t6"];
export const YOU_MIGHT_LIKE_IDS = ["t4", "t8", "t1", "t5", "t10"];

export const EXPLORE_TILES: { label: string; texture: TextureName }[] = [
  { label: "Lo-fi", texture: "tx-k2-topo" },
  { label: "Ambient", texture: "tx-k2-marble-dense" },
  { label: "Retro", texture: "tx-k2-checker" },
  { label: "Podcasts", texture: "tx-k2-static" },
  { label: "Night", texture: "tx-k-marble" },
  { label: "Focus", texture: "tx-k-silk" },
  { label: "Morning", texture: "tx-k2-horizon" },
  { label: "Glitch", texture: "tx-k-glitch" },
];

export function getTrack(id: string): MockTrack | undefined {
  return MOCK_TRACKS.find((t) => t.id === id);
}

export function getCollectionTracks(collection: MockCollection): MockTrack[] {
  return collection.trackIds
    .map(getTrack)
    .filter((t): t is MockTrack => t !== undefined);
}

export function searchMockCollections(query: string): MockCollection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return MOCK_COLLECTIONS.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/** Collections behind the history entries, deduped, newest first. */
export function recentCollections(
  history: MockHistoryEntry[],
  collections: MockCollection[]
): MockCollection[] {
  const seen = new Set<string>();
  const out: MockCollection[] = [];
  for (const entry of history) {
    if (seen.has(entry.collectionId)) continue;
    seen.add(entry.collectionId);
    const col = collections.find((c) => c.id === entry.collectionId);
    if (col) out.push(col);
  }
  return out;
}

export function searchMockTracks(query: string): MockTrack[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return MOCK_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  );
}
