import type { TextureName } from "@/components/studio/Texture";

/**
 * The controlled genre/mood vocabulary. Enrichment maps INTO this list and
 * never invents members of it, so the explore tiles, the genre split, and
 * recommendation filters all agree on identity — "lo-fi", "lofi", and "Lo-Fi"
 * cannot become three different genres.
 *
 * Seeded from EXPLORE_TILES in components/studio/screens/mock-data.ts; textures
 * are real names from components/studio/Texture.ts.
 */
export type Label = {
  labelId: string;
  kind: "genre" | "mood";
  displayName: string;
  texture: TextureName;
  aliases: string[];
  isExploreTile: boolean;
  sortOrder: number;
};

export const TAXONOMY: Label[] = [
  { labelId: "lofi", kind: "genre", displayName: "Lo-fi", texture: "tx-k-silk", aliases: ["lo-fi", "lo fi", "lofi hip hop", "lofi hiphop", "chillhop", "jazzhop"], isExploreTile: true, sortOrder: 1 },
  { labelId: "ambient", kind: "genre", displayName: "Ambient", texture: "tx-k2-horizon", aliases: ["ambient music", "drone", "atmospheric"], isExploreTile: true, sortOrder: 2 },
  { labelId: "retro", kind: "genre", displayName: "Retro", texture: "tx-k2-vinyl", aliases: ["synthwave", "vaporwave", "retrowave", "80s"], isExploreTile: true, sortOrder: 3 },
  { labelId: "podcasts", kind: "genre", displayName: "Podcasts", texture: "tx-k2-bars", aliases: ["podcast", "talk", "interview"], isExploreTile: true, sortOrder: 4 },
  { labelId: "night", kind: "mood", displayName: "Night", texture: "tx-k2-topo", aliases: ["late night", "midnight", "nocturnal"], isExploreTile: true, sortOrder: 5 },
  { labelId: "focus", kind: "mood", displayName: "Focus", texture: "tx-k2-ascii-eq", aliases: ["study", "concentration", "deep work", "study beats"], isExploreTile: true, sortOrder: 6 },
  { labelId: "morning", kind: "mood", displayName: "Morning", texture: "tx-k-ripple", aliases: ["wake up", "sunrise", "coffee"], isExploreTile: true, sortOrder: 7 },
  { labelId: "glitch", kind: "genre", displayName: "Glitch", texture: "tx-k-glitch", aliases: ["idm", "breakcore", "experimental"], isExploreTile: true, sortOrder: 8 },
  { labelId: "electronic", kind: "genre", displayName: "Electronic", texture: "tx-k2-static", aliases: ["electronic music", "edm", "house", "techno"], isExploreTile: false, sortOrder: 9 },
  { labelId: "hiphop", kind: "genre", displayName: "Hip hop", texture: "tx-k-marble", aliases: ["hip hop music", "hip-hop", "rap"], isExploreTile: false, sortOrder: 10 },
  { labelId: "jazz", kind: "genre", displayName: "Jazz", texture: "tx-k2-marble-dense", aliases: ["jazz music", "bebop"], isExploreTile: false, sortOrder: 11 },
  { labelId: "rock", kind: "genre", displayName: "Rock", texture: "tx-k2-checker", aliases: ["rock music", "indie rock", "alternative"], isExploreTile: false, sortOrder: 12 },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ");

const INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const l of TAXONOMY) {
    m.set(norm(l.labelId), l.labelId);
    m.set(norm(l.displayName), l.labelId);
    for (const a of l.aliases) m.set(norm(a), l.labelId);
  }
  return m;
})();

/** Maps a provider spelling onto a canonical label id, or null if unknown. */
export function resolveLabel(raw: string): string | null {
  return INDEX.get(norm(raw)) ?? null;
}

export function exploreTiles(): Label[] {
  return TAXONOMY.filter((l) => l.isExploreTile).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}
