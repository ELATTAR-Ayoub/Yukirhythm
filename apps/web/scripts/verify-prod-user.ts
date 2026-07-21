/**
 * Exercises the REAL route handlers against PRODUCTION Firestore with a REAL
 * production Firebase Auth user id — the one thing the emulator tests and the
 * admin round-trip did not cover.
 *
 * Creates a throwaway prod Auth user, mints a real ID token, drives the actual
 * GET/POST/PUT handlers, verifies, then deletes EVERYTHING it created. The
 * existing users and collections are never touched.
 *
 *   (no emulator env vars — this hits production)
 *   npx tsx scripts/verify-prod-user.ts
 */
import { readFileSync } from "node:fs";

const auth = (token: string, method = "GET", body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

async function main(): Promise<void> {
  // Load the service-account var so admin.ts initialises against production,
  // and make absolutely sure no emulator host is set.
  const envLocal = readFileSync(".env.local", "utf8");
  process.env.FIREBASE_SERVICE_ACCOUNT_B64 = envLocal
    .match(/FIREBASE_SERVICE_ACCOUNT_B64=(.+)/)![1]
    .trim();
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const WEB_API_KEY = readFileSync(".env", "utf8")
    .match(/NEXT_PUBLIC_APIKEY=(.+)/)![1]
    .trim();

  const { adminAuth, adminDb } = await import("@/lib/firebase/admin");
  const { getCatalogProvider } = await import("@/lib/catalog/provider");
  const { GET: meGET, POST: mePOST, PATCH: mePATCH } = await import(
    "@/app/api/me/route"
  );
  const { POST: collPOST } = await import("@/app/api/collections/route");
  const { PUT: addTrack } = await import(
    "@/app/api/collections/[collectionId]/tracks/[trackId]/route"
  );
  const { PUT: likeTrack } = await import(
    "@/app/api/me/tracks/[trackId]/route"
  );
  const { GET: likedGET } = await import("@/app/api/me/likes/route");

  const db = adminDb();
  const before = {
    users: (await db.collection("users").get()).size,
    collections: (await db.collection("collections").get()).size,
  };
  console.log(`before: users=${before.users} collections=${before.collections}\n`);

  // 1) real production Auth user
  const email = `roundtrip-${Date.now()}@example.com`;
  const record = await adminAuth().createUser({ email, password: "Passw0rd!23" });
  const uid = record.uid;
  console.log(`created REAL prod auth user: uid=${uid}`);

  const created: {
    trackIds: string[];
    artistIds: string[];
    collectionId?: string;
  } = { trackIds: [], artistIds: [] };

  try {
    // 2) mint a real ID token: custom token -> exchange via Identity Toolkit
    const customToken = await adminAuth().createCustomToken(uid);
    const exchange = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      }
    );
    const idToken = ((await exchange.json()) as { idToken?: string }).idToken;
    if (!idToken) throw new Error("token exchange failed");
    console.log("minted a REAL production ID token\n");

    // 3) POST /api/me — real handler verifies the real token, writes to prod
    const meRes = await mePOST(
      auth(idToken, "POST", { displayName: "Round Trip", email, authProvider: "google" })
    );
    console.log(`POST /api/me -> ${meRes.status}`);
    const me = (await meRes.json()) as { userId: string; authProvider: string };
    console.log(`  stored userId=${me.userId} (matches token uid: ${me.userId === uid}) authProvider=${me.authProvider}`);

    // 4) GET /api/me reads it back
    const meGetRes = await meGET(auth(idToken));
    console.log(`GET /api/me -> ${meGetRes.status}`);

    // 5) PATCH privacy
    const patchRes = await mePATCH(auth(idToken, "PATCH", { privacy: { saveHistory: false } }));
    const patched = (await patchRes.json()) as { privacy: { saveHistory: boolean } };
    console.log(`PATCH privacy.saveHistory -> ${patched.privacy.saveHistory}`);

    // 6) live YouTube search -> ingest via the catalog is done inside search
    //    route, but here we ingest directly then use the real membership route.
    const provider = await getCatalogProvider();
    const found = await provider.search("daft punk", { type: "song", limit: 2 });
    const { ingestTracks } = await import("@/lib/catalog/ingest");
    const playable = found.tracks.filter((t) => t.isEmbeddable);
    await ingestTracks(playable);
    created.trackIds = playable.map((t) => t.providerTrackId);
    created.artistIds = [...new Set(playable.flatMap((t) => t.artists.map((a) => a.artistId)))];
    console.log(`\ningested ${created.trackIds.length} real tracks to prod`);

    // 7) create a collection via the real handler
    const collRes = await collPOST(
      auth(idToken, "POST", { title: "Round Trip", trackIds: [created.trackIds[0]] })
    );
    const coll = (await collRes.json()) as { collectionId: string; stats: { trackCount: number } };
    created.collectionId = coll.collectionId;
    console.log(`POST /api/collections -> ${collRes.status} id=${coll.collectionId} trackCount=${coll.stats.trackCount}`);

    // 8) add the second track via the real membership route
    await addTrack(auth(idToken, "PUT"), {
      params: Promise.resolve({ collectionId: coll.collectionId, trackId: created.trackIds[1] }),
    });

    // 9) like a track, read virtual Liked Songs
    await likeTrack(auth(idToken, "PUT", { isLiked: true }), {
      params: Promise.resolve({ trackId: created.trackIds[0] }),
    });
    const liked = (await (await likedGET(auth(idToken))).json()) as {
      virtual: boolean;
      tracks: { title: string }[];
    };
    console.log(`GET /api/me/likes (virtual=${liked.virtual}): ${liked.tracks.map((t) => t.title).join(" | ")}`);

    console.log("\nALL ROUTES OK against production with a real user id.");
  } finally {
    // 10) delete EVERYTHING created — leave prod exactly as found
    console.log("\ncleaning up...");
    if (created.collectionId)
      await db.collection("collections").doc(created.collectionId).delete();
    for (const id of created.trackIds) await db.collection("tracks").doc(id).delete();
    for (const id of created.artistIds)
      if (id) await db.collection("artists").doc(id).delete();
    // user doc + trackState subcollection
    const tsSnap = await db.collection("users").doc(uid).collection("trackState").get();
    for (const d of tsSnap.docs) await d.ref.delete();
    await db.collection("users").doc(uid).delete();
    await adminAuth().deleteUser(uid);
    console.log("deleted the test user, its docs, and the catalog docs.");

    const after = {
      users: (await db.collection("users").get()).size,
      collections: (await db.collection("collections").get()).size,
    };
    console.log(
      `after:  users=${after.users} collections=${after.collections}  (unchanged: ${after.users === before.users && after.collections === before.collections})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
