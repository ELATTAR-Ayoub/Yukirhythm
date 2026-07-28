import { describe, it, expect } from "vitest";

import {
  SCREENS,
  AUTH,
  CREATE,
  QUEUE,
  isSystemRoute,
  playlistHref,
  playbackListHref,
  addMusicHref,
  sharedTrackHref,
  sharedPlaylistHref,
  authHref,
  isSafeAppPath,
} from "./routes";

describe("authHref", () => {
  it("builds only same-origin return links", () => {
    expect(authHref("/share/track/a b")).toBe(
      `${AUTH}?returnTo=%2Fshare%2Ftrack%2Fa%20b`
    );
    expect(authHref("https://evil.example")).toBe(AUTH);
    expect(authHref("//evil.example")).toBe(AUTH);
    expect(isSafeAppPath("/share/playlist/one")).toBe(true);
    expect(isSafeAppPath("javascript:alert(1)")).toBe(false);
  });
});

describe("isSystemRoute", () => {
  it("treats profile and its subpages as system routes", () => {
    expect(isSystemRoute(`${SCREENS}/profile`)).toBe(true);
    expect(isSystemRoute(`${SCREENS}/profile/settings`)).toBe(true);
    expect(isSystemRoute(`${SCREENS}/profile/privacy`)).toBe(true);
  });

  it("treats credits and terms as system routes", () => {
    expect(isSystemRoute(`${SCREENS}/credits`)).toBe(true);
    expect(isSystemRoute(`${SCREENS}/terms`)).toBe(true);
  });

  it("does not treat music surfaces as system routes", () => {
    expect(isSystemRoute(`${SCREENS}/home`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/search`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/library`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/playlist/liked`)).toBe(false);
  });

  it("does not treat the routed drawer pages as system routes", () => {
    // These carry the shell rails, unlike the system roots above — a system
    // classification here would incorrectly blank out both rails.
    expect(isSystemRoute(CREATE)).toBe(false);
    expect(isSystemRoute(QUEUE)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/playlist/liked/add`)).toBe(false);
  });

  it("does not match a route that merely starts with the same letters", () => {
    expect(isSystemRoute(`${SCREENS}/terminal`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/profiles`)).toBe(false);
  });

  it("tolerates a null pathname", () => {
    expect(isSystemRoute(null)).toBe(false);
  });
});

describe("playlistHref", () => {
  it("builds the playlist route and encodes the id", () => {
    expect(playlistHref("liked")).toBe(`${SCREENS}/playlist/liked`);
    expect(playlistHref("local 1")).toBe(`${SCREENS}/playlist/local%201`);
  });
});

describe("public share hrefs", () => {
  it("builds encoded anonymous listening routes", () => {
    expect(sharedTrackHref("track 1")).toBe(`${SCREENS}/share/track/track%201`);
    expect(sharedPlaylistHref("share 1")).toBe(
      `${SCREENS}/share/playlist/share%201`
    );
  });
});

describe("playbackListHref", () => {
  it("opens a playlist for collection playback and /queue only for ad-hoc playback", () => {
    expect(playbackListHref("collection 1")).toBe(
      `${SCREENS}/playlist/collection%201`
    );
    expect(playbackListHref(null)).toBe(QUEUE);
    expect(playbackListHref()).toBe(QUEUE);
    expect(
      playbackListHref("public-share", "/share/playlist/public-share")
    ).toBe("/share/playlist/public-share");
    expect(playbackListHref("collection 1", "//evil.example")).toBe(
      `${SCREENS}/playlist/collection%201`
    );
  });
});

describe("addMusicHref", () => {
  it("builds the add-music route beneath the playlist route and encodes the id", () => {
    expect(addMusicHref("liked")).toBe(`${SCREENS}/playlist/liked/add`);
    expect(addMusicHref("local 1")).toBe(`${SCREENS}/playlist/local%201/add`);
  });
});
