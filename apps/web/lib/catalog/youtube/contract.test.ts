import { describe, it, expect } from "vitest";
import { YoutubeCatalogProvider } from "./index";

/**
 * Network-gated drift detector. The previous scraper rotted to a ~90% failure
 * rate before anyone noticed; this is how that gets caught early.
 *
 * Run: CATALOG_LIVE=1 npx vitest run lib/catalog/youtube/contract
 */
const live = process.env.CATALOG_LIVE === "1";

describe.skipIf(!live)("YoutubeCatalogProvider (live)", () => {
  const p = new YoutubeCatalogProvider();

  it("searches songs with clean titles and structured artists", async () => {
    const r = await p.search("daft punk instant crush", {
      type: "song",
      limit: 5,
    });
    expect(r.tracks.length).toBeGreaterThan(0);
    expect(r.tracks[0].title).not.toContain("Official Video");
    expect(r.tracks[0].artists.length).toBeGreaterThan(0);
    expect(r.tracks[0].artwork.length).toBeGreaterThan(0);
  }, 30000);

  it("fetches a track with keywords and an embeddability flag", async () => {
    const t = await p.getTrack("a5uQMwRMHcs");
    expect(t).not.toBeNull();
    expect(t?.keywords.length).toBeGreaterThan(0);
    expect(typeof t?.isEmbeddable).toBe("boolean");
  }, 30000);

  it("returns related tracks for the cold-start recommender", async () => {
    const related = await p.getRelatedTracks("a5uQMwRMHcs");
    expect(related.length).toBeGreaterThan(0);
    expect(related[0].providerTrackId).toBeTruthy();
  }, 30000);

  it("suggests completions", async () => {
    expect((await p.suggest("daft")).length).toBeGreaterThan(0);
  }, 30000);

  it("fetches a playlist", async () => {
    const pl = await p.getPlaylist("PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo");
    expect(pl).not.toBeNull();
    expect(pl?.tracks.length).toBeGreaterThan(0);
  }, 30000);
});
