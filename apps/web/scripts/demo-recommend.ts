/**
 * Phase 7 end-to-end on REAL data through the REAL route handlers, backed by
 * the real Firestore emulator and LIVE YouTube radio. No mocks.
 *
 *   npm run emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     GCLOUD_PROJECT=demo-yukirhythm npx tsx scripts/demo-recommend.ts
 */
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { mintIdToken } from "@/lib/catalog/__integration__/emulator";

import { POST as ensureUser } from "@/app/api/me/route";
import { POST as postEvents } from "@/app/api/events/route";
import { GET as youMightLike } from "@/app/api/feed/you-might-like/route";
import { GET as newReleases } from "@/app/api/feed/new-releases/route";
import type { Track } from "@/lib/catalog/model";

const auth = (token: string, path = "/x") =>
  new Request(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
const post = (token: string, path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

type Item = { reason: string; recommendationId: string; track: Track };

async function main(): Promise<void> {
  const token = await mintIdToken(`demo-rec-${Date.now()}@x.com`);
  await ensureUser(post(token, "/api/me", {}));

  console.log("\n# the user plays a Daft Punk track (live YouTube)");
  const found = await (
    await getCatalogProvider()
  ).search("daft punk instant crush", { type: "song", limit: 1 });
  const seed = found.tracks[0];
  await ingestTracks([seed]);
  console.log(
    `  played: ${seed.title} — ${seed.artists.map((a) => a.name).join(", ")}`
  );
  // record a completed play, 8 days ago so it isn't excluded as "recent"
  await postEvents(
    post(token, "/api/events", {
      events: [
        {
          trackId: seed.providerTrackId,
          listenedSec: 200,
          startedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        },
      ],
    })
  );

  console.log("\n# You might like (live YouTube radio off what they played)");
  const yml = (await (await youMightLike(auth(token))).json()) as {
    items: Item[];
  };
  yml.items
    .slice(0, 6)
    .forEach((i) =>
      console.log(
        `  ${i.track.title} — ${i.track.artists.map((a) => a.name).join(", ")}  [${i.reason}]`
      )
    );

  console.log("\n# New releases (personalized, cold-padded with popular)");
  const nr = (await (await newReleases(auth(token))).json()) as {
    items: Item[];
  };
  nr.items
    .slice(0, 6)
    .forEach((i) =>
      console.log(
        `  ${i.track.title} — ${i.track.artists.map((a) => a.name).join(", ")}  [${i.reason}]`
      )
    );

  console.log(
    "\nDONE — real recommendations from real plays through real routes.\n"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
