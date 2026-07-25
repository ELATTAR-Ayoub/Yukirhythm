import type { Timestamp } from "firebase-admin/firestore";
import type { TextureName } from "@/components/studio/Texture";

/**
 * Firestore document shapes. Naming rules (spec §4): no wrapper objects,
 * camelCase, `Sec` for durations, `At` for timestamps, `Count` for counts,
 * booleans read as assertions, never a field called `private`.
 */

export const SCHEMA_VERSION = 1;
export const MAX_TRACKS_PER_COLLECTION = 5000;

/** Reserved id for the virtual Liked Songs collection (spec D8). */
export const LIKED_COLLECTION_ID = "liked";

export type Image = { url: string; width: number; height: number };

export type LabelSource =
  | "youtube-category"
  | "youtube-keywords"
  | "provider-topic"
  | "inferred"
  | "user";

export type TrackLabel = {
  label: string;
  kind: "genre" | "mood";
  source: LabelSource;
  confidence: number;
};

export type Track = {
  trackId: string;
  type: "track" | "episode";

  title: string;
  artists: { artistId: string; name: string }[];
  album: { albumId: string; name: string } | null;
  durationSec: number | null;
  /** Provider thumbnails (spec D6). */
  artwork: Image[];
  /** Deterministic from trackId (spec D6, §5.11) — the design-system fallback. */
  texture: TextureName;

  source: {
    provider: "youtube";
    videoId: string;
    url: string;
    aliasVideoIds: string[];
  };

  isEmbeddable: boolean;
  isLive: boolean;
  isFamilySafe: boolean;

  stats: { viewCount: number; likeCount: number; playCount: number };
  publishedAt: Timestamp | null;

  labels: TrackLabel[];
  /** Flat mirror of labels[].label. array-contains cannot match nested fields. */
  labelIds: string[];
  keywords: string[];
  episode?: { showId: string; number: number | null; publishedAt: Timestamp };

  enrichedAt: Timestamp | null;
  schemaVersion: number;
};

export type Artist = {
  artistId: string;
  name: string;
  bio: string | null;
  artwork: Image[];
  subscriberCount: number | null;
  relatedArtistIds: string[];
  labels: TrackLabel[];
  enrichedAt: Timestamp | null;
};

/** Membership carries its own timestamp so "Recently added" can sort (spec D7). */
export type CollectionTrack = {
  trackId: string;
  addedAt: Timestamp;
  addedBy: string;
};

export type Collection = {
  collectionId: string;
  ownerId: string;

  /** Container role. There is no "liked" role — that collection is virtual (D8). */
  role: "playlist" | "show";
  /** Drives the Library filter chips (D9). */
  contentType: "music" | "podcast";

  title: string;
  description: string;
  tags: string[];

  cover: "texture" | "mosaic" | "image";
  texture: TextureName;
  imageUrl: string | null;

  tracks: CollectionTrack[];
  visibility: "private" | "unlisted" | "public";

  stats: {
    trackCount: number;
    totalDurationSec: number;
    saveCount: number;
    playCount: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type UserPrivacy = {
  saveHistory: boolean;
  personalization: boolean;
  publicProfile: boolean;
};

export type UserSettings = {
  audioQuality: "auto" | "low" | "high";
  language: string;
  theme: "system" | "light" | "dark";
};

export type User = {
  userId: string;
  displayName: string;
  handle: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  authProvider: "google" | "facebook";
  counts: {
    followerCount: number;
    followingCount: number;
    collectionCount: number;
  };
  privacy: UserPrivacy;
  settings: UserSettings;
  createdAt: Timestamp;
};

export type TrackState = {
  trackId: string;
  isLiked: boolean;
  likedAt: Timestamp | null;
  playCount: number;
  completedCount: number;
  skipCount: number;
  totalListenedSec: number;
  lastPlayedAt: Timestamp | null;
  resumeSec: number;
  addedAt: Timestamp;
};

export type CollectionState = {
  collectionId: string;
  isPinned: boolean;
  lastOpenedAt: Timestamp | null;
};

/**
 * Social graph (spec §5.5). Both directions are stored so each list is a single
 * read: users/{uid}/following/{targetId} and users/{uid}/followers/{sourceId}.
 */
export type FollowEdge = {
  userId: string; // the other end of the edge
  followedAt: Timestamp;
};

/**
 * A saved reference to someone else's public collection — NOT a copy. The owner's
 * edits show through; if it goes private it drops from the library but the record
 * survives so it returns when re-published.
 */
export type SavedCollection = {
  collectionId: string;
  ownerId: string;
  savedAt: Timestamp;
  isPinned: boolean;
};

/** Public projection of a user — what another person may see. Never private fields. */
export type PublicProfile = {
  userId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  counts: User["counts"];
};

/**
 * Persisted playback (spec §5.8, D10). One document per user at
 * users/{uid}/playback/current, so playback resumes across reloads and follows
 * the user between devices. This is the only home for shuffle/repeat/volume —
 * the UI's loop button holds an inert local boolean today.
 */
export type PlaybackState = {
  trackId: string | null;
  sourceType: "collection" | "library" | "search" | "radio";
  sourceId: string | null;

  /** Resolved trackIds in play order. */
  queue: string[];
  /** -1 when nothing is playing. */
  queueIndex: number;
  /** "Play next" entries, consumed before the main queue. */
  manualQueue: string[];

  positionSec: number;
  isPlaying: boolean;
  shuffleMode: boolean;
  repeatMode: "off" | "all" | "one";
  /** 0..1. */
  volume: number;

  /** Last writer, for multi-device handoff. */
  deviceId: string;
  updatedAt: Timestamp;
};

export const REPEAT_MODES = ["off", "all", "one"] as const;

export type EventSource =
  "collection" | "search" | "library" | "radio" | "recommendation";

/**
 * An append-only play event (spec §5.9). `listenedSec` is actual seconds heard,
 * not the track length. `clientHourOfDay` is captured LOCAL to the user so the
 * stats histogram is correct even if their timezone later changes.
 */
export type PlayEvent = {
  eventId: string;
  userId: string;
  trackId: string;
  collectionId: string | null;

  startedAt: Timestamp;
  listenedSec: number;
  completed: boolean;
  skipped: boolean;

  source: EventSource;
  recommendationId: string | null;
  deviceId: string;
  clientHourOfDay: number;
};

/**
 * Listening stats (spec §5.10). Computed from playEvents on read today; a
 * cached rollup refreshed by a scheduled sweep is a later scale optimization.
 */
export type StatsRollup = {
  minutesWeek: number;
  minutesMonth: number;
  minutesYear: number;
  minutesAllTime: number;

  streakDays: number;
  lastListenDate: string | null; // "YYYY-MM-DD" in the user's timezone

  topArtists: { artistId: string; name: string; plays: number }[];
  topTrackIds: string[];
  genreSplit: { label: string; pct: number }[];
  byHour: number[]; // 24 entries, 0..1 normalised

  timezone: string;
};

/**
 * The completion floor. 30s matches industry convention and stops a six-hour
 * mix from being unskippable; below it, a play is a skip.
 */
export const COMPLETION_MIN_SEC = 30;

/** `listenedSec >= min(30, durationSec * 0.5)` — see spec §5.9. */
export function isCompleted(
  listenedSec: number,
  durationSec: number | null
): boolean {
  const threshold =
    durationSec && durationSec > 0
      ? Math.min(COMPLETION_MIN_SEC, durationSec * 0.5)
      : COMPLETION_MIN_SEC;
  return listenedSec >= threshold;
}

/** Fresh playback state for a user who has never played anything. */
export const EMPTY_PLAYBACK: Omit<PlaybackState, "updatedAt"> = {
  trackId: null,
  sourceType: "library",
  sourceId: null,
  queue: [],
  queueIndex: -1,
  manualQueue: [],
  positionSec: 0,
  isPlaying: false,
  shuffleMode: false,
  repeatMode: "off",
  volume: 1,
  deviceId: "",
};

/**
 * History and personalization default on because the product is built around
 * them; public profile defaults off because it exposes the user to others.
 */
export const DEFAULT_PRIVACY: UserPrivacy = {
  saveHistory: true,
  personalization: true,
  publicProfile: false,
};

export const DEFAULT_SETTINGS: UserSettings = {
  audioQuality: "auto",
  language: "en",
  theme: "system",
};
