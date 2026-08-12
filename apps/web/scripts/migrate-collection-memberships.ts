import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase/admin";
import { getCatalogProvider } from "../lib/catalog/provider";
import { toTrackDoc } from "../lib/catalog/ingest";
import type { Collection, Track } from "../lib/catalog/model";
import { migrateCollectionMemberships } from "../lib/catalog/collection-migration";
import { membershipIsComplete } from "../lib/catalog/membership";

type Mode = "dry-run" | "canary" | "execute" | "verify";
// Standalone scripts do not receive Next.js' automatic `.env.local` loading.
// Load the web app environment before validating the requested project so the
// same credentials used by local web testing are available to the migration.
loadEnvConfig(resolve(process.cwd()));
const args = process.argv.slice(2);
const value = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const project = value("--project");
const canaryId = value("--canary");
const mode: Mode = args.includes("--verify")
  ? "verify"
  : args.includes("--execute")
    ? "execute"
    : canaryId
      ? "canary"
      : "dry-run";
if (!project) throw new Error("--project <project-id> is required");
const projectId = project;

function configuredProject(): string | undefined {
  if (process.env.FIRESTORE_EMULATOR_HOST)
    return process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_PROJECTID;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!encoded) return undefined;
  return (
    JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      project_id?: string;
    }
  ).project_id;
}
if (configuredProject() !== projectId) {
  throw new Error(
    `Refusing project mismatch: requested ${projectId}, configured ${configuredProject() ?? "unknown"}`
  );
}

const reportDir = resolve(process.cwd(), ".migration-reports");
const checkpointPath = resolve(
  reportDir,
  `${projectId}-collection-memberships.json`
);
type Report = {
  project: string;
  mode: Mode;
  scanned: number;
  migrated: number;
  valid: number;
  failed: Array<{ collectionId: string; error: string }>;
  unresolved: Array<{ collectionId: string; trackIds: string[] }>;
  processedIds: string[];
};

async function loadCheckpoint(): Promise<Report | null> {
  try {
    return JSON.parse(await readFile(checkpointPath, "utf8")) as Report;
  } catch {
    return null;
  }
}
async function saveReport(report: Report) {
  await mkdir(reportDir, { recursive: true });
  await writeFile(checkpointPath, JSON.stringify(report, null, 2));
}

async function resolveTracks(ids: string[]): Promise<Map<string, Track>> {
  const db = adminDb();
  const tracks = new Map<string, Track>();
  for (let index = 0; index < ids.length; index += 100) {
    const batch = ids.slice(index, index + 100);
    const snaps = await db.getAll(
      ...batch.map((id) => db.collection("tracks").doc(id))
    );
    const missing: string[] = [];
    snaps.forEach((snap) => {
      if (snap.exists) tracks.set(snap.id, snap.data() as Track);
      else missing.push(snap.id);
    });
    if (missing.length) {
      const provider = await getCatalogProvider();
      const found = await provider.getTracks(missing);
      for (const providerTrack of found) {
        tracks.set(providerTrack.providerTrackId, toTrackDoc(providerTrack));
      }
    }
  }
  return tracks;
}

async function main() {
  const db = adminDb();
  const snapshot = canaryId
    ? await db
        .collection("collections")
        .where("collectionId", "==", canaryId)
        .get()
    : await db.collection("collections").get();
  const previous = args.includes("--resume") ? await loadCheckpoint() : null;
  const report: Report = previous ?? {
    project: projectId,
    mode,
    scanned: 0,
    migrated: 0,
    valid: 0,
    failed: [],
    unresolved: [],
    processedIds: [],
  };
  report.mode = mode;
  const processed = new Set(report.processedIds);

  for (const doc of snapshot.docs) {
    if (processed.has(doc.id)) continue;
    report.scanned++;
    const collection = doc.data() as Collection;
    try {
      if (mode === "verify") {
        const complete =
          collection.schemaVersion === 2 &&
          collection.tracks.every(membershipIsComplete) &&
          collection.stats.trackCount === collection.tracks.length &&
          collection.stats.totalDurationSec ===
            collection.tracks.reduce(
              (sum, entry) => sum + (entry.durationSec ?? 0),
              0
            );
        if (!complete)
          throw new Error("incomplete schema or inconsistent aggregates");
        report.valid++;
      } else {
        const ids = [
          ...new Set(collection.tracks.map((entry) => entry.trackId)),
        ];
        const tracks = await resolveTracks(ids);
        const result = migrateCollectionMemberships(collection, tracks);
        if (result.unresolvedTrackIds.length) {
          report.unresolved.push({
            collectionId: doc.id,
            trackIds: result.unresolvedTrackIds,
          });
        } else if (result.changed) {
          if (mode === "execute" || mode === "canary") {
            await doc.ref.set(
              { ...result.collection, updatedAt: Timestamp.now() },
              { merge: false }
            );
          }
          report.migrated++;
        } else report.valid++;
      }
    } catch (error) {
      report.failed.push({
        collectionId: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    report.processedIds.push(doc.id);
    processed.add(doc.id);
    await saveReport(report);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.failed.length || report.unresolved.length) process.exitCode = 1;
}

void main();
