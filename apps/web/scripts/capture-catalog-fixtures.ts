/**
 * Records real provider responses to __fixtures__/ so map.ts can be tested
 * offline. Re-run after a provider upgrade; a diff in the fixtures is the
 * early warning that YouTube changed a shape.
 *
 * Run from apps/web: npx tsx scripts/capture-catalog-fixtures.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Innertube } from "youtubei.js";

const DIR = join(
  process.cwd(),
  "lib",
  "catalog",
  "youtube",
  "__fixtures__"
);

// Chosen to cover the shapes that break naive mapping:
//   a5uQMwRMHcs  normal song, album + multiple artists
//   n61ULEU7CO0  6-hour mix, single artist, no album
const SONG_QUERY = "daft punk instant crush";
const VIDEO_ID = "a5uQMwRMHcs";
const LONG_VIDEO_ID = "n61ULEU7CO0";
const ARTIST_ID = "UC_kRDKYrUlrbtrSiyu5Tflg";
const PLAYLIST_ID = "PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo";

function save(name: string, data: unknown): void {
  writeFileSync(join(DIR, `${name}.json`), JSON.stringify(data, null, 2));
  console.log("wrote", name);
}

async function main(): Promise<void> {
  mkdirSync(DIR, { recursive: true });
  const yt = await Innertube.create({ lang: "en", location: "US" });

  const songs = await yt.music.search(SONG_QUERY, { type: "song" });
  const contents =
    (songs as unknown as { songs?: { contents?: unknown[] } }).songs?.contents ?? [];
  save("music-search-song", contents.slice(0, 5));

  save("video-info", (await yt.getInfo(VIDEO_ID)).basic_info);
  save("video-info-long", (await yt.getInfo(LONG_VIDEO_ID)).basic_info);

  const artist = await yt.music.getArtist(ARTIST_ID);
  save("music-artist", { header: (artist as unknown as { header?: unknown }).header });

  const playlist = await yt.getPlaylist(PLAYLIST_ID);
  save("playlist", {
    info: playlist.info,
    videos: (playlist.videos ?? []).slice(0, 5),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
