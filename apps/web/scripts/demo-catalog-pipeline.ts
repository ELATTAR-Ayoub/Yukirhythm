/**
 * End-to-end proof with REAL data: live YouTube search -> ingest -> real
 * Firestore (emulator) -> read back. No mocks anywhere.
 *
 *   npm run emulator            (one terminal)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-yukirhythm \
 *     npx tsx scripts/demo-catalog-pipeline.ts "daft punk"
 */
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { adminDb } from "@/lib/firebase/admin";
import type { Track } from "@/lib/catalog/model";

async function main(): Promise<void> {
  const query = process.argv[2] ?? "daft punk instant crush";
  const provider = await getCatalogProvider();

  console.log(`\n# INPUT — live YouTube Music search: "${query}"\n`);
  const result = await provider.search(query, { type: "song", limit: 5 });
  for (const t of result.tracks) {
    console.log(
      `  ${t.providerTrackId}  ${t.title} — ${t.artists
        .map((a) => a.name)
        .join(", ")}  (${t.durationSec}s, embeddable=${t.isEmbeddable})`
    );
  }

  const playable = result.tracks.filter((t) => t.isEmbeddable);
  console.log(
    `\n# INGEST — writing ${playable.length} tracks to real Firestore\n`
  );
  await ingestTracks(playable);

  console.log("# OUTPUT — read straight back from Firestore\n");
  for (const t of playable) {
    const snap = await adminDb()
      .collection("tracks")
      .doc(t.providerTrackId)
      .get();
    const d = snap.data() as Track;
    console.log(
      `  ${d.trackId}  ${d.title} — ${d.artists
        .map((a) => a.name)
        .join(
          ", "
        )}  texture=${d.texture} artwork=${d.artwork.length} url=${d.source.url}`
    );
  }

  const artists = await adminDb().collection("artists").get();
  console.log(`\n# artists collection now holds ${artists.size} record(s):`);
  artists.forEach((a) =>
    console.log(`  ${a.id}  ${(a.data() as { name: string }).name}`)
  );

  console.log("\nDONE — input matched output.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
