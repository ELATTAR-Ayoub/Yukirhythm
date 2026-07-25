/**
 * End-to-end proof for phase 2 with REAL data: live YouTube search feeds a
 * real playlist through the real route handlers, backed by the real Firestore
 * emulator. No mocks.
 *
 *   npm run emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     GCLOUD_PROJECT=demo-yukirhythm npx tsx scripts/demo-collections.ts
 */
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { mintIdToken } from "@/lib/catalog/__integration__/emulator";

import { POST as createUser } from "@/app/api/me/route";
import { POST as createCollection } from "@/app/api/collections/route";
import { GET as getCollection } from "@/app/api/collections/[collectionId]/route";
import {
  PUT as addTrack,
  DELETE as removeTrack,
} from "@/app/api/collections/[collectionId]/tracks/[trackId]/route";
import { PATCH as reorder } from "@/app/api/collections/[collectionId]/tracks/route";
import { PUT as likeTrack } from "@/app/api/me/tracks/[trackId]/route";
import { GET as getLiked } from "@/app/api/me/likes/route";

const auth = (token: string, method = "GET", body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

async function main(): Promise<void> {
  const token = await mintIdToken(`demo-${Date.now()}@x.com`);

  console.log("\n# live YouTube search: 'daft punk'");
  const provider = await getCatalogProvider();
  const found = await provider.search("daft punk", { type: "song", limit: 4 });
  const playable = found.tracks.filter((t) => t.isEmbeddable);
  await ingestTracks(playable);
  playable.forEach((t) =>
    console.log(
      `  ${t.providerTrackId}  ${t.title} — ${t.artists.map((a) => a.name).join(", ")}`
    )
  );

  await createUser(
    auth(token, "POST", { displayName: "Demo", email: "demo@x.com" })
  );

  console.log("\n# create a playlist with the first two tracks");
  const created = (await (
    await createCollection(
      auth(token, "POST", {
        title: "Daft Picks",
        tags: ["electronic"],
        trackIds: [playable[0].providerTrackId, playable[1].providerTrackId],
      })
    )
  ).json()) as {
    collectionId: string;
    stats: { trackCount: number; totalDurationSec: number };
  };
  const id = created.collectionId;
  console.log(
    `  ${id}  trackCount=${created.stats.trackCount}  totalSec=${created.stats.totalDurationSec}`
  );

  const params = { params: Promise.resolve({ collectionId: id }) };
  const trackParams = (trackId: string) => ({
    params: Promise.resolve({ collectionId: id, trackId }),
  });

  console.log("\n# add a third, remove the first, then reverse the order");
  await addTrack(auth(token, "PUT"), trackParams(playable[2].providerTrackId));
  await removeTrack(
    auth(token, "DELETE"),
    trackParams(playable[0].providerTrackId)
  );

  let c = (await (await getCollection(auth(token), params)).json()) as {
    tracks: { trackId: string }[];
    stats: { trackCount: number; totalDurationSec: number };
  };
  const remaining = c.tracks.map((t) => t.trackId);
  await reorder(
    auth(token, "PATCH", { trackIds: [...remaining].reverse() }),
    params
  );

  c = (await (await getCollection(auth(token), params)).json()) as typeof c;
  console.log(
    `  order: ${c.tracks.map((t) => t.trackId).join(" -> ")}  trackCount=${c.stats.trackCount}`
  );

  console.log("\n# like two tracks, then read the virtual Liked Songs");
  await likeTrack(auth(token, "PUT", { isLiked: true }), {
    params: Promise.resolve({ trackId: playable[0].providerTrackId }),
  });
  await likeTrack(auth(token, "PUT", { isLiked: true }), {
    params: Promise.resolve({ trackId: playable[3].providerTrackId }),
  });
  const liked = (await (await getLiked(auth(token))).json()) as {
    title: string;
    virtual: boolean;
    tracks: { title: string }[];
  };
  console.log(
    `  ${liked.title} (virtual=${liked.virtual}): ${liked.tracks.map((t) => t.title).join(" | ")}`
  );

  console.log("\nDONE — real data through real routes into real Firestore.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
