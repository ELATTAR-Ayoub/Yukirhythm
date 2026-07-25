import type { CatalogProvider } from "../provider";
import type {
  CatalogSearchResult,
  CatalogSearchType,
  ProviderArtist,
  ProviderPlaylist,
  ProviderTrack,
} from "../types";
import { youtubeClient } from "./client";
import {
  mapMusicArtist,
  mapMusicSong,
  mapPlaylist,
  mapUpNextVideo,
  mapVideoInfo,
} from "./map";

/**
 * Maps rows one at a time so a single malformed row cannot take down a whole
 * response. The provider is unofficial; partial results beat an exception.
 */
function mapSafe<T>(rows: unknown[], fn: (row: unknown) => T): T[] {
  const out: T[] = [];
  for (const row of rows) {
    try {
      out.push(fn(row));
    } catch {
      // skip the unmappable row
    }
  }
  return out;
}

export class YoutubeCatalogProvider implements CatalogProvider {
  async search(
    query: string,
    opts: { type: CatalogSearchType; limit: number }
  ): Promise<CatalogSearchResult> {
    const yt = await youtubeClient();
    const res = (await yt.music.search(query, {
      type: opts.type,
    })) as unknown as Record<string, { contents?: unknown[] } | undefined>;

    const empty: CatalogSearchResult = {
      query,
      type: opts.type,
      tracks: [],
      artists: [],
      playlists: [],
    };

    if (opts.type === "song") {
      const rows = (res.songs?.contents ?? []).slice(0, opts.limit);
      return { ...empty, tracks: mapSafe(rows, mapMusicSong) };
    }

    if (opts.type === "artist") {
      const rows = (res.artists?.contents ?? []).slice(0, opts.limit);
      return {
        ...empty,
        artists: mapSafe(rows, (r) => {
          const a = r as { id?: string };
          return mapMusicArtist(a.id ?? "", { header: r });
        }),
      };
    }

    return empty;
  }

  async suggest(query: string): Promise<string[]> {
    const yt = await youtubeClient();
    const res = (await yt.music.getSearchSuggestions(query)) as unknown as {
      contents?: unknown[];
    }[];

    const out: string[] = [];
    for (const section of res ?? []) {
      for (const item of section?.contents ?? []) {
        const s = item as { suggestion?: { text?: string } };
        if (s.suggestion?.text) out.push(s.suggestion.text);
      }
    }
    return out;
  }

  async getTrack(providerTrackId: string): Promise<ProviderTrack | null> {
    const yt = await youtubeClient();
    try {
      const info = await yt.getInfo(providerTrackId);
      return mapVideoInfo(info.basic_info);
    } catch {
      return null;
    }
  }

  async getTracks(ids: string[]): Promise<ProviderTrack[]> {
    const out = await Promise.all(ids.map((id) => this.getTrack(id)));
    return out.filter((t): t is ProviderTrack => t !== null);
  }

  async getArtist(artistId: string): Promise<ProviderArtist | null> {
    const yt = await youtubeClient();
    try {
      return mapMusicArtist(artistId, await yt.music.getArtist(artistId));
    } catch {
      return null;
    }
  }

  /**
   * The cold-start recommender. Music's up-next radio returns related songs
   * for any seed track, which is what lets suggestions work on day one with
   * no behavioural data of our own.
   */
  async getRelatedTracks(providerTrackId: string): Promise<ProviderTrack[]> {
    const yt = await youtubeClient();
    try {
      const up = (await yt.music.getUpNext(providerTrackId)) as unknown as {
        contents?: unknown[];
      };
      const rows = (up.contents ?? []).filter((r) => {
        const row = r as { video_id?: string };
        return row.video_id && row.video_id !== providerTrackId;
      });
      // mapUpNextVideo (not mapMusicSong directly) — the panel row carries a
      // `duration` field mapMusicSong knows how to read, but a search row's
      // shape does not, so building the wrong object here silently drops it.
      return mapSafe(rows, mapUpNextVideo);
    } catch {
      return [];
    }
  }

  async getPlaylist(playlistId: string): Promise<ProviderPlaylist | null> {
    const yt = await youtubeClient();
    try {
      return mapPlaylist(playlistId, await yt.getPlaylist(playlistId));
    } catch {
      return null;
    }
  }
}
