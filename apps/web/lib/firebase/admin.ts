import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * The whole service-account JSON, base64-encoded, in one env var. Base64
 * avoids the private-key newline mangling that plagues env-var secrets on
 * Vercel. Set FIREBASE_SERVICE_ACCOUNT_B64 in Vercel and in .env.local.
 */
function loadCredential() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  }
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return cert(json);
}

/**
 * When FIRESTORE_EMULATOR_HOST is set the Admin SDK talks to the local
 * emulator, which is the real Firestore engine and needs no credential — only
 * a project id. This is how local dev and integration tests run against real
 * Firestore behaviour without production secrets. It is never true in
 * production, where the env var is unset and the service account is required.
 */
function usingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

// Serverless re-invokes module scope; initializing twice throws.
function adminApp(): App {
  if (getApps().length) return getApp();
  if (usingEmulator()) {
    return initializeApp({
      projectId:
        process.env.GCLOUD_PROJECT ??
        process.env.NEXT_PUBLIC_PROJECTID ??
        "demo-yukirhythm",
    });
  }
  return initializeApp({ credential: loadCredential() });
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
