/**
 * Helpers for integration tests that run against the real Firestore emulator.
 */

const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-yukirhythm";
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

/** Wipes every document in the emulator via its admin REST endpoint. */
export async function clearFirestore(): Promise<void> {
  const res = await fetch(
    `http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(
      `Failed to clear emulator (${res.status}). Is it running? \`npm run emulator\``
    );
  }
}

/** True when the emulator is reachable; lets a suite skip cleanly if it is not. */
export async function emulatorUp(): Promise<boolean> {
  try {
    const res = await fetch(`http://${HOST}/`, { method: "GET" });
    return res.ok || res.status === 200 || res.status === 404;
  } catch {
    return false;
  }
}

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

/**
 * Signs up a throwaway user in the Auth emulator and returns a real ID token.
 * `adminAuth().verifyIdToken()` accepts it because FIREBASE_AUTH_EMULATOR_HOST
 * is set — the whole path is real token verification, not a stub.
 */
export async function mintIdToken(email: string): Promise<string> {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "password123",
        returnSecureToken: true,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Auth emulator signUp failed (${res.status})`);
  }
  const body = (await res.json()) as { idToken: string };
  return body.idToken;
}
