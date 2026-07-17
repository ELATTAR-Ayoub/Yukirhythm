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

// Serverless re-invokes module scope; initializing twice throws.
function adminApp(): App {
  return getApps().length
    ? getApp()
    : initializeApp({ credential: loadCredential() });
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
