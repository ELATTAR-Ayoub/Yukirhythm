import type { MockTrack } from "@/components/studio/screens/mock-data";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SPOTIFY_LIKED_SONGS_ID = "spotify-liked-songs";
export const SPOTIFY_IMPORT_TOKEN_KEY = "yukirhythm:spotify-import:token:v2";
export const SPOTIFY_IMPORT_OAUTH_KEY = "yukirhythm:spotify-import:oauth:v2";
export const SPOTIFY_IMPORT_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
] as const;

export type SpotifyImportToken = {
  accessToken: string;
  expiresAt: number;
};

export type SpotifyOAuthSession = {
  verifier: string;
  state: string;
  redirectUri: string;
};

export type SpotifyPlaylistSummary = {
  id: string;
  source: "liked-songs" | "playlist";
  name: string;
  description: string;
  imageUrl: string | null;
  itemCount: number;
  externalUrl: string;
};

export type SpotifySourceTrack = {
  id: string;
  title: string;
  artists: string[];
  album: string;
  durationSec: number | null;
  externalUrl: string;
  position: number;
};

export type SpotifyPlaylistTracks = {
  tracks: SpotifySourceTrack[];
  skipped: number;
};

export type SpotifyTrackMatch = {
  source: SpotifySourceTrack;
  track: MockTrack | null;
  score: number;
  included: boolean;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type SpotifyPage<T> = {
  items?: T[];
  next?: string | null;
  total?: number;
};

type RawSpotifyPlaylist = {
  id?: string;
  name?: string;
  description?: string | null;
  images?: { url?: string }[];
  external_urls?: { spotify?: string };
  items?: { total?: number };
  tracks?: { total?: number };
};

type RawSpotifyTrack = {
  id?: string;
  name?: string;
  type?: string;
  is_local?: boolean;
  duration_ms?: number;
  artists?: { name?: string }[];
  album?: { name?: string };
  external_urls?: { spotify?: string };
};

type RawSpotifyPlaylistItem = {
  /** Current Spotify Web API shape (February 2026 onward). */
  item?: RawSpotifyTrack | null;
  /** Accepted for older/extended-quota responses during the migration. */
  track?: RawSpotifyTrack | null;
};

type RawSpotifySavedTrack = {
  track?: RawSpotifyTrack | null;
  /** Accepted defensively if Spotify unifies saved-item wrappers later. */
  item?: RawSpotifyTrack | null;
};

export class SpotifyImportError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterSec?: number
  ) {
    super(message);
    this.name = "SpotifyImportError";
  }
}

function spotifyErrorMessage(
  status: number,
  fallback: string,
  detail?: string,
  forbiddenMessage?: string
): string {
  if (status === 401) return "Your Spotify connection expired. Reconnect it.";
  if (status === 403)
    return (
      forbiddenMessage ??
      "Spotify only allows importing playlists you own or collaborate on."
    );
  if (status === 429)
    return "Spotify is receiving too many requests. Wait a moment and retry.";
  return detail || fallback || `Spotify returned HTTP ${status}.`;
}

async function spotifyRequest<T>(
  url: string,
  accessToken: string,
  fetchImpl: FetchLike,
  forbiddenMessage?: string
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string } | string;
    } | null;
    const detail =
      typeof body?.error === "string"
        ? body.error
        : (body?.error?.message ?? undefined);
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfter =
      retryAfterHeader == null ? Number.NaN : Number(retryAfterHeader);
    throw new SpotifyImportError(
      spotifyErrorMessage(
        response.status,
        response.statusText,
        detail,
        forbiddenMessage
      ),
      response.status,
      Number.isFinite(retryAfter) ? retryAfter : undefined
    );
  }
  return (await response.json()) as T;
}

export async function fetchSpotifyPlaylists(
  accessToken: string,
  fetchImpl: FetchLike = fetch
): Promise<SpotifyPlaylistSummary[]> {
  const playlists: SpotifyPlaylistSummary[] = [];
  let next: string | null = `${SPOTIFY_API}/me/playlists?limit=50`;

  while (next) {
    const page: SpotifyPage<RawSpotifyPlaylist> = await spotifyRequest(
      next,
      accessToken,
      fetchImpl
    );
    for (const playlist of page.items ?? []) {
      if (!playlist.id || !playlist.name) continue;
      playlists.push({
        id: playlist.id,
        source: "playlist",
        name: playlist.name,
        description: playlist.description ?? "",
        imageUrl: playlist.images?.find((image) => image.url)?.url ?? null,
        itemCount: playlist.items?.total ?? playlist.tracks?.total ?? 0,
        externalUrl:
          playlist.external_urls?.spotify ??
          `https://open.spotify.com/playlist/${playlist.id}`,
      });
    }
    next = page.next ?? null;
  }

  return playlists;
}

export async function fetchSpotifyImportSources(
  accessToken: string,
  fetchImpl: FetchLike = fetch
): Promise<SpotifyPlaylistSummary[]> {
  const [likedSongsPage, playlists] = await Promise.all([
    spotifyRequest<SpotifyPage<RawSpotifySavedTrack>>(
      `${SPOTIFY_API}/me/tracks?limit=1`,
      accessToken,
      fetchImpl,
      "Spotify did not grant access to Liked Songs. Reconnect Spotify and approve library access."
    ),
    fetchSpotifyPlaylists(accessToken, fetchImpl),
  ]);

  return [
    {
      id: SPOTIFY_LIKED_SONGS_ID,
      source: "liked-songs",
      name: "Liked Songs",
      description: "Songs saved to your Spotify library.",
      imageUrl: null,
      itemCount: likedSongsPage.total ?? likedSongsPage.items?.length ?? 0,
      externalUrl: "https://open.spotify.com/collection/tracks",
    },
    ...playlists,
  ];
}

function toSpotifySourceTrack(
  item: RawSpotifyTrack | null,
  position: number
): SpotifySourceTrack | null {
  const artists = (item?.artists ?? [])
    .map((artist) => artist.name?.trim() ?? "")
    .filter(Boolean);
  if (
    !item ||
    item.type !== "track" ||
    item.is_local ||
    !item.name?.trim() ||
    artists.length === 0
  ) {
    return null;
  }
  return {
    id: item.id ?? `spotify-position-${position}`,
    title: item.name.trim(),
    artists,
    album: item.album?.name?.trim() ?? "",
    durationSec:
      typeof item.duration_ms === "number"
        ? Math.round(item.duration_ms / 1000)
        : null,
    externalUrl:
      item.external_urls?.spotify ??
      (item.id ? `https://open.spotify.com/track/${item.id}` : ""),
    position,
  };
}

export async function fetchSpotifyPlaylistTracks(
  playlistId: string,
  accessToken: string,
  fetchImpl: FetchLike = fetch
): Promise<SpotifyPlaylistTracks> {
  const tracks: SpotifySourceTrack[] = [];
  let skipped = 0;
  let position = 0;
  let next: string | null =
    `${SPOTIFY_API}/playlists/${encodeURIComponent(playlistId)}` +
    "/items?limit=50&additional_types=track";

  while (next) {
    const page: SpotifyPage<RawSpotifyPlaylistItem> = await spotifyRequest(
      next,
      accessToken,
      fetchImpl
    );
    for (const wrapper of page.items ?? []) {
      const item = wrapper.item ?? wrapper.track ?? null;
      const track = toSpotifySourceTrack(item, position);
      if (!track) {
        skipped += 1;
        position += 1;
        continue;
      }
      tracks.push(track);
      position += 1;
    }
    next = page.next ?? null;
  }

  return { tracks, skipped };
}

export async function fetchSpotifyLikedSongsTracks(
  accessToken: string,
  fetchImpl: FetchLike = fetch
): Promise<SpotifyPlaylistTracks> {
  const tracks: SpotifySourceTrack[] = [];
  let skipped = 0;
  let position = 0;
  let next: string | null = `${SPOTIFY_API}/me/tracks?limit=50`;
  const forbiddenMessage =
    "Spotify did not grant access to Liked Songs. Reconnect Spotify and approve library access.";

  while (next) {
    const page: SpotifyPage<RawSpotifySavedTrack> = await spotifyRequest(
      next,
      accessToken,
      fetchImpl,
      forbiddenMessage
    );
    for (const wrapper of page.items ?? []) {
      const item = wrapper.track ?? wrapper.item ?? null;
      const track = toSpotifySourceTrack(item, position);
      if (track) tracks.push(track);
      else skipped += 1;
      position += 1;
    }
    next = page.next ?? null;
  }

  return { tracks, skipped };
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(feat|featuring|ft)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(/\s+/).filter(Boolean));
}

function tokenSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

export function scoreSpotifyMatch(
  source: SpotifySourceTrack,
  candidate: MockTrack
): number {
  const sourceTitle = normalize(source.title);
  const candidateTitle = normalize(candidate.title);
  const exactTitle =
    sourceTitle === candidateTitle ||
    sourceTitle.includes(candidateTitle) ||
    candidateTitle.includes(sourceTitle);
  const titleScore = Math.max(
    exactTitle ? 0.95 : 0,
    tokenSimilarity(source.title, candidate.title)
  );
  const artistScore = Math.max(
    ...source.artists.map((artist) =>
      tokenSimilarity(artist, candidate.artist)
    ),
    0
  );
  const durationScore =
    source.durationSec && candidate.durationSec
      ? Math.max(
          0,
          1 - Math.abs(source.durationSec - candidate.durationSec) / 30
        )
      : 0.5;

  return titleScore * 0.65 + artistScore * 0.25 + durationScore * 0.1;
}

export function pickBestSpotifyMatch(
  source: SpotifySourceTrack,
  candidates: MockTrack[],
  minimumScore = 0.48
): { track: MockTrack | null; score: number } {
  const ranked = candidates
    .map((track) => ({ track, score: scoreSpotifyMatch(source, track) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < minimumScore) return { track: null, score: 0 };
  return best;
}

function randomString(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    ""
  );
}

function base64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function createSpotifyOAuthRequest({
  clientId,
  redirectUri,
}: {
  clientId: string;
  redirectUri: string;
}): Promise<{ url: string; session: SpotifyOAuthSession }> {
  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = base64Url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  );
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: SPOTIFY_IMPORT_SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  return {
    url: `https://accounts.spotify.com/authorize?${params}`,
    session: { verifier, state, redirectUri },
  };
}

export async function exchangeSpotifyCode({
  clientId,
  code,
  session,
  fetchImpl = fetch,
}: {
  clientId: string;
  code: string;
  session: SpotifyOAuthSession;
  fetchImpl?: FetchLike;
}): Promise<SpotifyImportToken> {
  const response = await fetchImpl(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: session.redirectUri,
      code_verifier: session.verifier,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    throw new SpotifyImportError(
      body?.error_description ||
        "Spotify could not finish connecting. Please try again.",
      response.status
    );
  }

  return {
    accessToken: body.access_token,
    // Leave a one-minute safety margin so an import never starts on a token
    // that expires halfway through fetching a large playlist.
    expiresAt: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 60) * 1000,
  };
}

export function spotifySearchQuery(track: SpotifySourceTrack): string {
  return `${track.title} ${track.artists.join(" ")}`.trim();
}
