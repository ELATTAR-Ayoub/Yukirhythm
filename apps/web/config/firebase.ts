// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_APIKEY,
  authDomain: process.env.NEXT_PUBLIC_AUTHDOMAIN,
  projectId: process.env.NEXT_PUBLIC_PROJECTID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGEBUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGINGSENDERID,
  appId: process.env.NEXT_PUBLIC_APPID,
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENTID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = getAuth(app);

// Local development against the Auth emulator: set NEXT_PUBLIC_AUTH_EMULATOR to
// its host so the client mints tokens the server-side emulator accepts. Never
// set in production, where this points at the real Firebase Auth.
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_AUTH_EMULATOR &&
  !("__authEmulatorConnected" in globalThis)
) {
  connectAuthEmulator(auth, `http://${process.env.NEXT_PUBLIC_AUTH_EMULATOR}`, {
    disableWarnings: true,
  });
  (globalThis as Record<string, unknown>).__authEmulatorConnected = true;
}
