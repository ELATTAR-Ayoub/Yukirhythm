"use client";

import { useEffect, useState } from "react";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/config/firebase";
import {
  activeGuestId,
  endGuestSession,
  GUEST_SESSION_EVENT,
  startGuestSession,
} from "./guest-session";

export type StudioIdentity = Pick<
  FirebaseUser,
  "uid" | "displayName" | "email" | "photoURL" | "providerData"
>;

export type AuthState = {
  user: StudioIdentity | null;
  loading: boolean;
};

/** Subscribes to Firebase auth state. `loading` is true until the first emit. */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(() => {
    let firebaseUser = auth.currentUser;
    const update = () => {
      const uid = activeGuestId();
      const next = {
        user: uid
          ? {
              uid,
              displayName: "Guest",
              email: null,
              photoURL: null,
              providerData: [],
            }
          : firebaseUser,
        loading: false,
      };
      setState((previous) =>
        uid && previous.user?.uid === uid && !previous.loading ? previous : next
      );
    };
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      firebaseUser = user;
      update();
    });
    window.addEventListener(GUEST_SESSION_EVENT, update);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === "yukirhythm:guest-active:v1" ||
        event.key === "yukirhythm:guest-id:v1"
      )
        update();
    };
    window.addEventListener("storage", onStorage);
    if (activeGuestId()) update();
    return () => {
      unsubscribe();
      window.removeEventListener(GUEST_SESSION_EVENT, update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return state;
}

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

/** Which provider the user signed in with, stored on the User doc. */
export async function signIn(
  provider: "google" | "facebook"
): Promise<{ provider: "google" | "facebook" }> {
  await signInWithPopup(
    auth,
    provider === "facebook" ? facebookProvider : googleProvider
  );
  endGuestSession();
  return { provider };
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
  endGuestSession();
}

export function signInAsGuest(): void {
  startGuestSession();
}

/**
 * Dev-only email/password sign-in for the Auth emulator — no popup, so the
 * migration can be driven headlessly. Creates the account on first use. Never
 * exposed in production (guarded by NEXT_PUBLIC_AUTH_EMULATOR at the call site).
 */
export async function devSignIn(
  email: string,
  password: string
): Promise<void> {
  const { createUserWithEmailAndPassword, signInWithEmailAndPassword } =
    await import("firebase/auth");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch {
    await createUserWithEmailAndPassword(auth, email, password);
  }
}
