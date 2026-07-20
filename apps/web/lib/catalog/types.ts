/**
 * Provider-neutral catalog DTOs. Nothing in this file may reference YouTube
 * shapes — that knowledge lives only in lib/catalog/youtube/map.ts, so a
 * provider swap touches one file.
 */

export type ProviderImage = {
  url: string;
  width: number;
  height: number;
};

export type ProviderArtistRef = {
  artistId: string;
  name: string;
};

export type ProviderAlbumRef = {
  albumId: string;
  name: string;
};

export type ProviderTrack = {
  /** Canonical id. The Music song id when one exists, else the video id. */
  providerTrackId: string;
  /** The playable YouTube video id. May differ from providerTrackId. */
  videoId: string;
  type: "track" | "episode";

  title: string;
  artists: ProviderArtistRef[];
  album: ProviderAlbumRef | null;
  /** Integer seconds. null for live streams, which have no length. */
  durationSec: number | null;
  artwork: ProviderImage[];

  /** False means the IFrame player cannot play it. Callers MUST filter on this. */
  isEmbeddable: boolean;
  isLive: boolean;
  isFamilySafe: boolean;

  viewCount: number;
  likeCount: number;
  /** ISO 8601 string, or null when the provider gives only a relative label. */
  publishedAt: string | null;

  /** Raw uploader tags. Unprocessed input for enrichment (phase 4). */
  keywords: string[];
  categoryName: string | null;
};

export type ProviderArtist = {
  artistId: string;
  name: string;
  bio: string | null;
  artwork: ProviderImage[];
  subscriberCount: number | null;
  relatedArtistIds: string[];
};

export type ProviderPlaylist = {
  playlistId: string;
  title: string;
  description: string;
  artwork: ProviderImage[];
  trackCount: number;
  tracks: ProviderTrack[];
};

export type CatalogSearchType = "song" | "album" | "artist" | "playlist";

export type CatalogSearchResult = {
  query: string;
  type: CatalogSearchType;
  tracks: ProviderTrack[];
  artists: ProviderArtist[];
  playlists: ProviderPlaylist[];
};
