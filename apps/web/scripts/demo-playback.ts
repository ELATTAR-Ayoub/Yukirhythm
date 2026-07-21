/**
 * Phase 3 end-to-end on REAL data through the REAL route handlers, backed by
 * the real Firestore emulator. No mocks.
 *
 *   npm run emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     GCLOUD_PROJECT=demo-yukirhythm npx tsx scripts/demo-playback.ts
 */
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { mintIdToken } from "@/lib/catalog/__integration__/emulator";

import { GET as getPlayback, PUT as putPlayback } from "@/app/api/me/playback/route";
import { POST as enqueue } from "@/app/api/me/playback/queue/route";
import { DELETE as removeAt } from "@/app/api/me/playback/queue/[index]/route";
import type { PlaybackState } from "@/lib/catalog/model";

const auth = (token: string, method = "GET", body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

const show = (s: PlaybackState, label: string) =>
  console.log(
    `  ${label}: queue=[${s.queue.join(",")}] cursor=${s.queueIndex} manual=[${s.manualQueue.join(",")}] shuffle=${s.shuffleMode} repeat=${s.repeatMode} vol=${s.volume}`
  );

async function main(): Promise<void> {
  const token = await mintIdToken(`demo-play-${Date.now()}@x.com`);

  console.log("\n# live YouTube search -> build a queue");
  const found = await (await getCatalogProvider()).search("daft punk", { type: "song", limit: 4 });
  const playable = found.tracks.filter((t) => t.isEmbeddable);
  await ingestTracks(playable);
  const ids = playable.map((t) => t.providerTrackId);
  playable.forEach((t) => console.log(`  ${t.providerTrackId}  ${t.title}`));

  console.log("\n# save playback state: playing track 2, shuffle on, repeat all, vol 0.6");
  await putPlayback(
    auth(token, "PUT", {
      trackId: ids[1],
      queue: ids,
      queueIndex: 1,
      shuffleMode: true,
      repeatMode: "all",
      volume: 0.6,
      isPlaying: true,
      deviceId: "demo-web",
    })
  );
  show((await (await getPlayback(auth(token))).json()) as PlaybackState, "restored");

  console.log("\n# play next, then enqueue at end");
  await enqueue(auth(token, "POST", { trackId: "up-next-track", mode: "next" }));
  const afterEnq = (await (await enqueue(auth(token, "POST", { trackId: "later-track", mode: "end" }))).json()) as PlaybackState;
  show(afterEnq, "after enqueue");

  console.log("\n# remove the first track (before the cursor) — current track must not shift");
  const afterRemove = (await (await removeAt(auth(token, "DELETE"), { params: Promise.resolve({ index: "0" }) })).json()) as PlaybackState;
  show(afterRemove, "after remove");
  console.log(`  current track still: ${afterRemove.queue[afterRemove.queueIndex]} (was ${ids[1]})`);

  console.log("\n# simulate a reload: GET returns exactly what we left");
  show((await (await getPlayback(auth(token))).json()) as PlaybackState, "reloaded");

  console.log("\nDONE — playback persisted and resumed through real routes into real Firestore.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
