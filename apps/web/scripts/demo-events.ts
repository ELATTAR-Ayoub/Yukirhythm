/**
 * Phase 4 end-to-end on REAL data through the REAL route handlers, backed by
 * the real Firestore emulator. No mocks.
 *
 *   npm run emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     GCLOUD_PROJECT=demo-yukirhythm npx tsx scripts/demo-events.ts
 */
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { mintIdToken } from "@/lib/catalog/__integration__/emulator";
import { adminDb } from "@/lib/firebase/admin";

import { POST as ensureUser } from "@/app/api/me/route";
import { POST as postEvents } from "@/app/api/events/route";
import { DELETE as clearHistory } from "@/app/api/me/history/route";
import type { TrackState } from "@/lib/catalog/model";

const auth = (token: string, method = "GET", body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

async function main(): Promise<void> {
  const token = await mintIdToken(`demo-ev-${Date.now()}@x.com`);
  await ensureUser(auth(token, "POST", {}));
  const uid = (await adminDb().collection("users").get()).docs[0].id;

  console.log("\n# live YouTube search -> ingest");
  const found = await (
    await getCatalogProvider()
  ).search("daft punk", { type: "song", limit: 2 });
  const playable = found.tracks.filter((t) => t.isEmbeddable);
  await ingestTracks(playable);
  const [a, b] = playable.map((t) => t.providerTrackId);
  playable.forEach((t) =>
    console.log(`  ${t.providerTrackId}  ${t.title} (${t.durationSec}s)`)
  );

  console.log(
    "\n# post play events: full play of A, quick skip of A, full play of B"
  );
  await postEvents(
    auth(token, "POST", {
      events: [
        {
          trackId: a,
          listenedSec: 200,
          source: "collection",
          collectionId: "c1",
          clientHourOfDay: 9,
        },
        { trackId: a, listenedSec: 4, source: "search", clientHourOfDay: 9 },
        {
          trackId: b,
          listenedSec: 180,
          source: "recommendation",
          recommendationId: "rec-42",
          clientHourOfDay: 22,
        },
      ],
    })
  );

  const state = async (id: string) =>
    (
      await adminDb()
        .collection("users")
        .doc(uid)
        .collection("trackState")
        .doc(id)
        .get()
    ).data() as TrackState;
  const sa = await state(a);
  const sb = await state(b);
  console.log(
    `  ${a}: plays=${sa.playCount} completed=${sa.completedCount} skipped=${sa.skipCount} listenedSec=${sa.totalListenedSec}`
  );
  console.log(
    `  ${b}: plays=${sb.playCount} completed=${sb.completedCount} skipped=${sb.skipCount} listenedSec=${sb.totalListenedSec}`
  );

  const events = await adminDb()
    .collection("playEvents")
    .where("userId", "==", uid)
    .get();
  console.log(`  playEvents stored: ${events.size}`);

  console.log("\n# clear history");
  await clearHistory(auth(token, "DELETE"));
  const after = await adminDb()
    .collection("playEvents")
    .where("userId", "==", uid)
    .get();
  const saAfter = await state(a);
  console.log(
    `  events now: ${after.size}; ${a} plays reset to ${saAfter.playCount}`
  );

  console.log("\nDONE — real play events, real counters, real Firestore.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
