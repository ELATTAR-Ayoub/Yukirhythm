/**
 * Phase 5 end-to-end on REAL data through the REAL route handlers, backed by
 * the real Firestore emulator. No mocks.
 *
 *   npm run emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     GCLOUD_PROJECT=demo-yukirhythm npx tsx scripts/demo-stats.ts
 */
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { mintIdToken } from "@/lib/catalog/__integration__/emulator";
import { adminDb } from "@/lib/firebase/admin";

import { POST as ensureUser } from "@/app/api/me/route";
import { POST as postEvents } from "@/app/api/events/route";
import { GET as getStats } from "@/app/api/me/stats/route";
import { GET as getRecents } from "@/app/api/me/recents/route";
import type { StatsRollup } from "@/lib/catalog/model";

const auth = (token: string, path = "/x", method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

async function main(): Promise<void> {
  const token = await mintIdToken(`demo-stats-${Date.now()}@x.com`);
  await ensureUser(auth(token, "/api/me", "POST", {}));

  const found = await (
    await getCatalogProvider()
  ).search("daft punk", { type: "song", limit: 3 });
  const playable = found.tracks.filter((t) => t.isEmbeddable);
  await ingestTracks(playable);
  const ids = playable.map((t) => t.providerTrackId);
  // label one track so the genre split is non-empty
  await adminDb()
    .collection("tracks")
    .doc(ids[0])
    .set({ labelIds: ["electronic"] }, { merge: true });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  console.log("\n# post a week of plays (some today, some earlier)");
  await postEvents(
    auth(token, "/api/events", "POST", {
      events: [
        {
          trackId: ids[0],
          listenedSec: 300,
          startedAt: now,
          collectionId: "c1",
          clientHourOfDay: 9,
        },
        {
          trackId: ids[0],
          listenedSec: 280,
          startedAt: now - DAY,
          clientHourOfDay: 9,
        },
        {
          trackId: ids[1],
          listenedSec: 200,
          startedAt: now - DAY,
          clientHourOfDay: 22,
        },
        {
          trackId: ids[2],
          listenedSec: 190,
          startedAt: now - 2 * DAY,
          clientHourOfDay: 22,
        },
      ],
    })
  );

  const s = (await (
    await getStats(auth(token, "/api/me/stats?tz=UTC"))
  ).json()) as StatsRollup;
  console.log("\n# stats");
  console.log(
    `  minutesWeek=${s.minutesWeek} minutesAllTime=${s.minutesAllTime} streakDays=${s.streakDays}`
  );
  console.log(
    `  topArtist=${s.topArtists[0]?.name} (${s.topArtists[0]?.plays} plays)`
  );
  console.log(
    `  genreSplit=${s.genreSplit.map((g) => `${g.label} ${g.pct}%`).join(", ") || "(none)"}`
  );
  console.log(
    `  peak hour bucket: ${s.byHour.indexOf(Math.max(...s.byHour))}:00`
  );

  const recents = (await (
    await getRecents(auth(token, "/api/me/recents?limit=3"))
  ).json()) as {
    items: {
      track: { title: string } | null;
      collection: { title: string } | null;
    }[];
    nextCursor: number | null;
  };
  console.log("\n# recents (newest first)");
  recents.items.forEach((it) =>
    console.log(
      `  ${it.track?.title}${it.collection ? ` — from ${it.collection.title}` : ""}`
    )
  );
  console.log(`  nextCursor: ${recents.nextCursor ? "more pages" : "end"}`);

  console.log(
    "\nDONE — stats and recents computed from real events in real Firestore.\n"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
