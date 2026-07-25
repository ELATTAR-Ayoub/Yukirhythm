import { describe, it, expect } from "vitest";

import songs from "./__fixtures__/music-search-song.json";
import videoInfo from "./__fixtures__/video-info.json";
import videoInfoLong from "./__fixtures__/video-info-long.json";
import artistFixture from "./__fixtures__/music-artist.json";
import playlistFixture from "./__fixtures__/playlist.json";
import upNextFixture from "./__fixtures__/music-up-next.json";

import {
  mapMusicArtist,
  mapMusicSong,
  mapPlaylist,
  mapUpNextVideo,
  mapVideoInfo,
  mergeTrack,
} from "./map";

describe("mapMusicSong", () => {
  it("maps a song to a ProviderTrack", () => {
    const t = mapMusicSong(songs[0]);
    expect(t.providerTrackId).toBeTruthy();
    expect(t.videoId).toBe(t.providerTrackId);
    expect(t.type).toBe("track");
    expect(t.title.length).toBeGreaterThan(0);
    expect(t.durationSec).toBeGreaterThan(0);
    expect(t.artwork.length).toBeGreaterThan(0);
  });

  it("keeps the clean Music title, not the video title", () => {
    expect(mapMusicSong(songs[0]).title).not.toContain("Official Video");
  });

  it("returns structured artists — this is what collapses duplicates", () => {
    const t = mapMusicSong(songs[0]);
    expect(t.artists.length).toBeGreaterThan(0);
    expect(t.artists[0].name.length).toBeGreaterThan(0);
    expect(t.artists[0].artistId).toMatch(/^UC/);
  });

  it("reads the album", () => {
    expect(mapMusicSong(songs[0]).album?.name.length).toBeGreaterThan(0);
  });

  it("unwraps the MusicThumbnail contents wrapper", () => {
    const t = mapMusicSong(songs[0]);
    expect(t.artwork[0].url).toMatch(/^https?:/);
    expect(t.artwork[0].width).toBeGreaterThan(0);
  });

  it("defaults missing optional data rather than throwing", () => {
    const t = mapMusicSong({ id: "x", title: "T" });
    expect(t.providerTrackId).toBe("x");
    expect(t.artists).toEqual([]);
    expect(t.album).toBeNull();
    expect(t.durationSec).toBeNull();
    expect(t.artwork).toEqual([]);
    expect(t.viewCount).toBe(0);
  });

  it("assumes embeddable until getInfo says otherwise", () => {
    expect(mapMusicSong({ id: "x", title: "T" }).isEmbeddable).toBe(true);
  });
});

describe("mapVideoInfo", () => {
  it("extracts the enrichment fields", () => {
    const t = mapVideoInfo(videoInfo);
    expect(t.videoId).toBeTruthy();
    expect(t.keywords.length).toBeGreaterThan(0);
    expect(t.categoryName).toBe("Music");
    expect(t.likeCount).toBeGreaterThan(0);
    expect(t.viewCount).toBeGreaterThan(0);
    expect(t.durationSec).toBeGreaterThan(0);
    expect(t.artists[0]?.artistId).toMatch(/^UC/);
  });

  it("handles a multi-hour video", () => {
    expect(mapVideoInfo(videoInfoLong).durationSec).toBeGreaterThan(3600);
  });

  it("treats a live stream as having no duration", () => {
    const t = mapVideoInfo({ id: "x", title: "T", is_live: true, duration: 0 });
    expect(t.isLive).toBe(true);
    expect(t.durationSec).toBeNull();
  });

  it("reports a non-embeddable video, which cannot be played", () => {
    expect(mapVideoInfo({ id: "x", title: "T" }).isEmbeddable).toBe(false);
    expect(
      mapVideoInfo({ id: "x", title: "T", embed: true }).isEmbeddable
    ).toBe(true);
  });

  it("drops a relative date rather than storing an unusable value", () => {
    expect(
      mapVideoInfo({ id: "x", title: "T", start_timestamp: "12 years ago" })
        .publishedAt
    ).toBeNull();
  });

  it("keeps a real ISO date", () => {
    const t = mapVideoInfo({
      id: "x",
      title: "T",
      start_timestamp: "2013-12-06T08:00:01Z",
    });
    expect(t.publishedAt).toBe("2013-12-06T08:00:01.000Z");
  });
});

describe("mapUpNextVideo", () => {
  // Regression for the you-might-like shelf rendering "0:00" on every card:
  // the related-tracks path built its own row object and forgot `duration`.
  it("keeps the real duration from the up-next/radio panel, not 0 or null", () => {
    const t = mapUpNextVideo(upNextFixture[1]); // "Get Lucky", lengthText "3:58"
    expect(t.durationSec).not.toBeNull();
    expect(t.durationSec).toBeGreaterThan(0);
    expect(t.durationSec).toBe(238);
  });

  it("parses a plausible duration for every related row in the fixture", () => {
    for (const row of upNextFixture) {
      const t = mapUpNextVideo(row);
      expect(t.durationSec).not.toBeNull();
      expect(t.durationSec).toBeGreaterThan(0);
    }
  });

  it("still carries id, title and artists", () => {
    const t = mapUpNextVideo(upNextFixture[2]); // "Dracula" / Tame Impala
    expect(t.providerTrackId).toBe("xnP7qKxwzjg");
    expect(t.title).toBe("Dracula");
    expect(t.artists[0]?.name).toBe("Tame Impala");
    expect(t.durationSec).toBe(234); // lengthText "3:54"
  });

  it("defaults to no duration rather than throwing when the row lacks one", () => {
    expect(
      mapUpNextVideo({ video_id: "x", title: "T" }).durationSec
    ).toBeNull();
  });
});

describe("mergeTrack", () => {
  it("keeps the Music identity and title, taking enrichment from the video", () => {
    const song = mapMusicSong(songs[0]);
    const video = mapVideoInfo(videoInfo);
    const merged = mergeTrack(song, video);

    expect(merged.providerTrackId).toBe(song.providerTrackId);
    expect(merged.title).toBe(song.title);
    expect(merged.artists).toEqual(song.artists);
    expect(merged.album).toEqual(song.album);

    expect(merged.keywords.length).toBeGreaterThan(0);
    expect(merged.likeCount).toBe(video.likeCount);
    expect(merged.isEmbeddable).toBe(video.isEmbeddable);
  });
});

describe("mapMusicArtist", () => {
  it("maps the artist header", () => {
    const a = mapMusicArtist("UC_kRDKYrUlrbtrSiyu5Tflg", artistFixture);
    expect(a.artistId).toBe("UC_kRDKYrUlrbtrSiyu5Tflg");
    expect(a.name.length).toBeGreaterThan(0);
  });
});

describe("mapPlaylist", () => {
  it("maps items from the lockup shape", () => {
    const p = mapPlaylist("PL1", playlistFixture);
    expect(p.playlistId).toBe("PL1");
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.tracks.length).toBeGreaterThan(0);
    expect(p.tracks[0].videoId).toBeTruthy();
    expect(p.tracks[0].title.length).toBeGreaterThan(0);
  });

  it("drops rows with no video id", () => {
    const p = mapPlaylist("PL1", { info: {}, videos: [{}, {}] });
    expect(p.tracks).toEqual([]);
  });
});
