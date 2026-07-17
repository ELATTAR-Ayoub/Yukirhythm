import { auth } from "@/config/firebase";
import type { Audio, Collection, User } from "@/constants/interfaces";

async function authedFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  return res;
}

export const api = {
  getMe: async (): Promise<User | null> => {
    const res = await authedFetch("/api/me");
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load user");
    return res.json();
  },
  ensureMe: async (userData: Record<string, unknown>): Promise<User> => {
    const res = await authedFetch("/api/me", {
      method: "POST",
      body: JSON.stringify(userData),
    });
    if (!res.ok) throw new Error("Failed to create user");
    return res.json();
  },
  getProfile: async (uid: string): Promise<User | Record<string, never>> => {
    const res = await authedFetch(`/api/users/${uid}`);
    if (!res.ok) return {};
    return res.json();
  },
  getUserCollections: async (uid: string): Promise<Collection[]> => {
    const res = await authedFetch(`/api/users/${uid}/collections`);
    if (!res.ok) throw new Error("Failed to load collections");
    return res.json();
  },
  likeAudio: (audio: Audio) =>
    authedFetch("/api/me/loved-songs", {
      method: "PUT",
      body: JSON.stringify({ audio }),
    }),
  dislikeAudio: (audioId: string) =>
    authedFetch(`/api/me/loved-songs/${audioId}`, { method: "DELETE" }),
  addCollection: (collection: Collection) =>
    authedFetch("/api/collections", {
      method: "POST",
      body: JSON.stringify(collection),
    }),
  likeCollection: (id: string) =>
    authedFetch(`/api/me/loved-collections/${id}`, { method: "PUT" }),
  dislikeCollection: (id: string) =>
    authedFetch(`/api/me/loved-collections/${id}`, { method: "DELETE" }),
};
