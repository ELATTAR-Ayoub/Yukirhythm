/**
 * Phase 6 end-to-end on REAL data through the REAL route handlers, backed by
 * the real Firestore emulator. No mocks. Two users share music.
 *
 *   npm run emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     GCLOUD_PROJECT=demo-yukirhythm npx tsx scripts/demo-social.ts
 */
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { mintIdToken } from "@/lib/catalog/__integration__/emulator";

import { POST as ensureUser, PATCH as patchUser } from "@/app/api/me/route";
import { POST as createCollection, GET as listCollections } from "@/app/api/collections/route";
import { PATCH as patchCollection } from "@/app/api/collections/[collectionId]/route";
import { PUT as save } from "@/app/api/collections/[collectionId]/save/route";
import { PUT as follow } from "@/app/api/users/[uid]/follow/route";
import { GET as getProfile } from "@/app/api/users/[uid]/route";
import type { Collection, PublicProfile, User } from "@/lib/catalog/model";

const auth = (token: string, path = "/x", method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

const uidOf = async (token: string, name: string): Promise<string> =>
  ((await (await ensureUser(auth(token, "/api/me", "POST", { displayName: name }))).json()) as User).userId;

async function main(): Promise<void> {
  const tA = await mintIdToken(`demo-a-${Date.now()}@x.com`);
  const tB = await mintIdToken(`demo-b-${Date.now()}@x.com`);
  await uidOf(tA, "Ayoub");
  const uidB = await uidOf(tB, "Yuki");

  console.log("\n# Yuki builds a public playlist from live YouTube");
  const found = await (await getCatalogProvider()).search("daft punk", { type: "song", limit: 3 });
  const playable = found.tracks.filter((t) => t.isEmbeddable);
  await ingestTracks(playable);
  const c = (await (
    await createCollection(auth(tB, "/api/collections", "POST", {
      title: "Yuki's Daft Picks",
      trackIds: playable.map((t) => t.providerTrackId),
    }))
  ).json()) as Collection;
  await patchCollection(auth(tB, "/x", "PATCH", { visibility: "public" }), {
    params: Promise.resolve({ collectionId: c.collectionId }),
  });
  await patchUser(auth(tB, "/api/me", "PATCH", { privacy: { publicProfile: true } }));
  console.log(`  "${c.title}" (${c.stats.trackCount} tracks), public`);

  console.log("\n# Ayoub views Yuki's public profile, follows, and saves the playlist");
  const profile = (await (await getProfile(auth(tA), { params: Promise.resolve({ uid: uidB }) })).json()) as PublicProfile;
  console.log(`  profile: ${profile.displayName} (followers ${profile.counts.followerCount})`);

  await follow(auth(tA, "/x", "PUT"), { params: Promise.resolve({ uid: uidB }) });
  await save(auth(tA, "/x", "PUT"), { params: Promise.resolve({ collectionId: c.collectionId }) });

  const yukiAfter = (await (await getProfile(auth(tA), { params: Promise.resolve({ uid: uidB }) })).json()) as PublicProfile;
  console.log(`  after follow: Yuki followers = ${yukiAfter.counts.followerCount}`);

  const lib = (await (await listCollections(auth(tA))).json()) as Collection[];
  const saved = lib.find((x) => x.collectionId === c.collectionId);
  console.log(`  Ayoub's library now includes "${saved?.title}" (owner ${saved?.ownerId === uidB ? "Yuki" : "?"}, saveCount ${saved?.stats.saveCount})`);

  console.log("\nDONE — real users sharing real music through real routes into real Firestore.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
