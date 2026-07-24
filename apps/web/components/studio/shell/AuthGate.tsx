"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Loader from "@/components/Loader";
import { useAuthState } from "@/lib/studio/useAuth";
import { AUTH } from "./routes";

/**
 * The studio shell's front door: signed out means the login page and nothing
 * else. Client-side because auth itself is client-side Firebase — there is no
 * session cookie a middleware could verify.
 *
 * While auth is settling this renders the loader, never children: "not yet
 * known" must not flash gated content, and must not bounce a returning user
 * through /auth either (so no redirect until `loading` clears).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthState();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(AUTH);
  }, [user, loading, router]);

  if (loading || !user) return <Loader />;
  return <>{children}</>;
}
