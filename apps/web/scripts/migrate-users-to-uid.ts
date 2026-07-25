/**
 * One-time migration: move each user doc from its random Firestore ID to a
 * document keyed by the user's Firebase Auth uid (userData.ID).
 *
 * SAFETY:
 *   1. BACK UP FIRESTORE FIRST (Firebase console → export, or
 *      `gcloud firestore export`). This script deletes old docs on --apply.
 *   2. Dry-run by default. Pass --apply to write.
 *   3. Idempotent: docs already keyed by uid are skipped.
 *
 * Auth: set GOOGLE_APPLICATION_CREDENTIALS to the path of a service-account
 * JSON key (Firebase console → Project settings → Service accounts →
 * Generate new private key). Do NOT commit that file.
 *
 * Run:
 *   Dry-run: npm run migrate:users
 *   Apply:   npm run migrate:users -- --apply
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY = process.argv.includes("--apply");

function completeness(userData: Record<string, unknown> | undefined): number {
  if (!userData) return -1;
  const fields = [
    "avatar",
    "userName",
    "email",
    "lovedSongs",
    "collections",
    "lovedCollections",
    "followers",
    "following",
  ];
  return fields.reduce((n, f) => {
    const v = userData[f];
    const filled = Array.isArray(v) ? v.length > 0 : Boolean(v);
    return n + (filled ? 1 : 0);
  }, 0);
}

async function main() {
  console.log(
    `\n=== User migration (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n` +
      (APPLY
        ? "WRITING changes. Make sure you exported Firestore first.\n"
        : "No changes will be written. Re-run with --apply to migrate.\n")
  );

  const snap = await db.collection("users").get();
  const byUid = new Map<string, { id: string; data: DocumentData }[]>();

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const uid = data?.userData?.ID;
    if (!uid) {
      console.warn(`SKIP ${docSnap.id}: no userData.ID`);
      return;
    }
    const list = byUid.get(uid) ?? [];
    list.push({ id: docSnap.id, data });
    byUid.set(uid, list);
  });

  let toMigrate = 0;
  let duplicates = 0;
  let alreadyOk = 0;

  for (const [uid, docs] of byUid) {
    const alreadyKeyed = docs.find((d) => d.id === uid);
    const winner = docs
      .slice()
      .sort(
        (a, b) => completeness(b.data.userData) - completeness(a.data.userData)
      )[0];

    if (docs.length > 1) {
      duplicates++;
      console.log(
        `DUP  uid=${uid}: ${docs.length} docs [${docs
          .map((d) => d.id)
          .join(", ")}] → keep ${winner.id}`
      );
    }

    if (alreadyKeyed && docs.length === 1) {
      alreadyOk++;
      continue;
    }

    toMigrate++;
    console.log(`MOVE uid=${uid}: winner ${winner.id} → users/${uid}`);

    if (alreadyKeyed && winner.id !== uid) {
      console.warn(
        `OVERWRITE uid=${uid}: replacing existing users/${uid} with more-complete doc ${winner.id}`
      );
    }

    if (APPLY) {
      await db.collection("users").doc(uid).set(winner.data);
      for (const d of docs) {
        if (d.id !== uid) {
          console.log(`  delete loser ${d.id} (uid=${uid})`);
          await db.collection("users").doc(d.id).delete();
        }
      }
    }
  }

  console.log(
    `\nSummary: ${byUid.size} users | migrate ${toMigrate} | duplicates ${duplicates} | already-ok ${alreadyOk}`
  );
  if (!APPLY) console.log("Dry-run only. Re-run with --apply to write.\n");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
