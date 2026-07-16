import { vi } from "vitest";

import type { User } from "@/constants/interfaces";

/** A blank signed-out user, matching the AuthContext default shape. */
export const emptyUser: User = {
  ID: "",
  docID: "",
  avatar: "",
  userName: "",
  email: "",
  marketingEmails: false,
  lovedSongs: [],
  collections: [],
  lovedCollections: [],
  followers: [],
  following: [],
};

export const signedInUser: User = {
  ...emptyUser,
  ID: "uid-1",
  docID: "uid-1",
  userName: "Tester",
  email: "t@example.com",
};

/**
 * Build a stub of the useAuth() context value. Mocking this module is what
 * keeps config/firebase.ts (which calls initializeApp at module scope) from
 * ever being imported during tests.
 */
export function makeAuthValue(user: User = emptyUser) {
  return {
    user,
    signin: vi.fn(),
    signup: vi.fn(),
    signupPopup: vi.fn(),
    signinPopup: vi.fn(),
    logout: vi.fn(),
    getUser: vi.fn(),
    likeAudio: vi.fn(),
    dislikeAudio: vi.fn(),
    addCollection: vi.fn(),
    likeCollection: vi.fn(),
    dislikeCollection: vi.fn(),
    getProfileUser: vi.fn().mockResolvedValue(user),
    getUserCollections: vi.fn().mockResolvedValue([]),
  };
}
