import { describe, it, expect } from "vitest";

import { SCREENS, isSystemRoute, playlistHref } from "./routes";

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
