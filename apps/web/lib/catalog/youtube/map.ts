import type {
  ProviderAlbumRef,
  ProviderArtist,
  ProviderArtistRef,
  ProviderImage,
  ProviderPlaylist,
  ProviderTrack,
} from "../types";

/**
 * Converts youtubei.js shapes into provider-neutral DTOs. This is the ONLY
 * file that knows YouTube's response structure, so a provider swap touches
 * one file.
 *
 * Every field is read defensively: the provider is an unofficial client of
 * YouTube's internal API and its shapes drift without notice. A missing field
 * degrades that field, never the whole row.
 */

type Raw = Record<string, unknown>;

const asRecord = (v: unknown): Raw =>
  v && typeof v === "object" ? (v as Raw) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** youtubei.js text nodes are sometimes a bare string, sometimes `{ text }`. */
export function text(v: unknown): string {
  if (typeof v === "string") return v;
  const r = asRecord(v);
  return typeof r.text === "string" ? r.text : "";
}

/**
 * Thumbnails arrive either as a bare array (video info) or wrapped as
 * `{ type: "MusicThumbnail", contents: [...] }` (Music search).
 */
export function mapImages(v: unknown): ProviderImage[] {
  const list = Array.isArray(v) ? v : asArray(asRecord(v).contents);
  return list
    .map((raw) => {
      const t = asRecord(raw);
      return {
        url: typeof t.url === "string" ? t.url : "",
        width: typeof t.width === "number" ? t.width : 0,
        height: typeof t.height === "number" ? t.height : 0,
      };
    })
    .filter((t) => t.url !== "");
}

function mapArtists(v: unknown): ProviderArtistRef[] {
  return asArray(v)
    .map((raw) => {
      const a = asRecord(raw);
      return {
        artistId: typeof a.channel_id === "string" ? a.channel_id : "",
        name: text(a.name),
      };
    })
    .filter((a) => a.name !== "");
}

function mapAlbum(v: unknown): ProviderAlbumRef | null {
  const a = asRecord(v);
  const name = text(a.name);
  if (!name) return null;
  return { albumId: typeof a.id === "string" ? a.id : "", name };
}

/**
 * A YouTube Music song. This is the canonical identity: a clean title, real
 * artists, and a real album — which is what collapses the five-videos-one-song
 * duplication a plain video search produces.
 */
export function mapMusicSong(raw: unknown): ProviderTrack {
  const s = asRecord(raw);
  const id = typeof s.id === "string" ? s.id : "";
  const duration = asRecord(s.duration);

  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: text(s.title),
    artists: mapArtists(s.artists),
    album: mapAlbum(s.album),
    // A missing lengthText parses (via youtubei.js's timeToSeconds on "N/A")
    // to NaN rather than throwing — Number.isFinite keeps that from leaking
    // out as a fake duration.
    durationSec:
      typeof duration.seconds === "number" && Number.isFinite(duration.seconds)
        ? duration.seconds
        : null,
    artwork: mapImages(s.thumbnail ?? s.thumbnails),
    // Music search does not report embeddability; getInfo does. Assume
    // playable and let enrichment correct it, rather than hiding everything.
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 0,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
  };
}

/**
 * A row from Music's up-next/radio panel (`music.getUpNext`, the cold-start
 * recommender's source). Unlike a bare search row, youtubei.js has *already*
 * parsed the panel's `lengthText` ("3:54") into `duration.seconds` for us —
 * so this is mapMusicSong plus forwarding the field the caller previously
 * dropped, not a new mm:ss parser.
 */
export function mapUpNextVideo(raw: unknown): ProviderTrack {
  const r = asRecord(raw);
  return mapMusicSong({
    id: r.video_id,
    title: r.title,
    artists: r.artists,
    duration: r.duration,
  });
}

function toIso(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  const d = new Date(v);
  // Relative labels like "12 years ago" parse to Invalid Date — drop them
  // rather than storing an unusable value.
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A video record. This is the enrichment source: keywords, category, like
 * count, and the embeddability flag Music search cannot provide.
 */
export function mapVideoInfo(raw: unknown): ProviderTrack {
  const b = asRecord(raw);
  const id = typeof b.id === "string" ? b.id : "";
  const isLive = b.is_live === true;
  const duration = typeof b.duration === "number" ? b.duration : null;
  const channel = asRecord(b.channel);
  const channelId = typeof b.channel_id === "string" ? b.channel_id : "";
  const name = text(b.author) || text(channel.name);

  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: text(b.title),
    artists: name ? [{ artistId: channelId, name }] : [],
    album: null,
    durationSec: isLive || !duration ? null : duration,
    artwork: mapImages(b.thumbnail),
    // `embed` is populated only when the video may be embedded. A false here
    // means the IFrame player will refuse to play it.
    isEmbeddable: Boolean(b.embed),
    isLive,
    isFamilySafe: b.is_family_safe !== false,
    viewCount: typeof b.view_count === "number" ? b.view_count : 0,
    likeCount: typeof b.like_count === "number" ? b.like_count : 0,
    // basic_info carries no publish date — start_timestamp is null for
    // non-live videos. Real dates live on info.primary_info, which phase 7
    // needs for new-release recency and can fetch then.
    publishedAt: toIso(b.start_timestamp),
    keywords: asArray(b.keywords).filter(
      (k): k is string => typeof k === "string"
    ),
    categoryName: typeof b.category === "string" ? b.category : null,
  };
}

/**
 * Combines a Music song (canonical identity, clean title, real artists and
 * album) with its video record (keywords, counts, embeddability). Identity
 * always comes from the song.
 */
export function mergeTrack(
  song: ProviderTrack,
  video: ProviderTrack
): ProviderTrack {
  return {
    ...song,
    videoId: video.videoId || song.videoId,
    durationSec: song.durationSec ?? video.durationSec,
    artwork: song.artwork.length ? song.artwork : video.artwork,
    isEmbeddable: video.isEmbeddable,
    isLive: video.isLive,
    isFamilySafe: video.isFamilySafe,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    publishedAt: video.publishedAt,
    keywords: video.keywords,
    categoryName: video.categoryName,
  };
}

export function mapMusicArtist(artistId: string, raw: unknown): ProviderArtist {
  const a = asRecord(raw);
  const header = asRecord(a.header);
  const subs = asRecord(header.subscribers);
  return {
    artistId,
    name: text(header.title),
    bio: text(header.description) || null,
    artwork: mapImages(header.thumbnail ?? header.thumbnails),
    subscriberCount: typeof subs.count === "number" ? subs.count : null,
    relatedArtistIds: [],
  };
}

/** Playlist rows use the lockup shape: metadata rows of text parts. */
export function mapPlaylistItem(raw: unknown): ProviderTrack {
  const it = asRecord(raw);
  const meta = asRecord(it.metadata);
  const inner = asRecord(meta.metadata);
  const parts = asArray(inner.metadata_rows).flatMap((r) =>
    asArray(asRecord(r).metadata_parts).map((p) => text(asRecord(p).text))
  );
  const id = typeof it.content_id === "string" ? it.content_id : "";

  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: text(meta.title),
    artists: parts[0] ? [{ artistId: "", name: parts[0] }] : [],
    album: null,
    durationSec: null,
    artwork: mapImages(asRecord(meta.image).sources),
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 0,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
  };
}

export function mapPlaylist(
  playlistId: string,
  raw: unknown
): ProviderPlaylist {
  const p = asRecord(raw);
  const info = asRecord(p.info);
  return {
    playlistId,
    title: text(info.title),
    description: text(info.description),
    artwork: mapImages(info.thumbnails),
    trackCount: typeof info.total_items === "number" ? info.total_items : 0,
    tracks: asArray(p.videos)
      .map(mapPlaylistItem)
      .filter((t) => t.videoId !== ""),
  };
}
