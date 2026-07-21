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

export type AuthState = {
  user: FirebaseUser | null;
  loading: boolean;
};

/** Subscribes to Firebase auth state. `loading` is true until the first emit. */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(
    () => onAuthStateChanged(auth, (user) => setState({ user, loading: false })),
    []
  );
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
  return { provider };
}

export function signOutUser(): Promise<void> {
  return fbSignOut(auth);
}
