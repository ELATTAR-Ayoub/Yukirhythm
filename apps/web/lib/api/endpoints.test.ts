import { describe, it, expect } from "vitest";
import { endpoints } from "./endpoints";

describe("endpoints registry", () => {
  it("builds catalog urls with query params and encoding", () => {
    expect(endpoints.catalog.search("daft punk", "song")).toBe(
      "/api/catalog/search?q=daft%20punk&type=song"
    );
    expect(endpoints.catalog.search("x")).toBe("/api/catalog/search?q=x");
    expect(endpoints.catalog.tracksByLabel("lofi")).toBe(
      "/api/catalog/tracks?label=lofi"
    );
    expect(endpoints.catalog.track("a/b")).toBe("/api/catalog/tracks/a%2Fb");
  });

  it("drops empty query values instead of emitting bare keys", () => {
    expect(endpoints.catalog.search("x", undefined)).toBe(
      "/api/catalog/search?q=x"
    );
    expect(endpoints.me.recents()).toBe("/api/me/recents");
  });

  it("scopes per-user resources under /me and never puts a uid in the path", () => {
    expect(endpoints.me.likes()).toBe("/api/me/likes");
    expect(endpoints.me.track("t1")).toBe("/api/me/tracks/t1");
    expect(endpoints.me.pin("c1")).toBe("/api/me/pins/c1");
    expect(endpoints.me.library("rain")).toBe("/api/me/library?q=rain");
  });

  it("uses PATCH-on-tracks for reorder, not an /order action segment", () => {
    expect(endpoints.collections.tracks("c1")).toBe(
      "/api/collections/c1/tracks"
    );
    expect(endpoints.collections.track("c1", "t1")).toBe(
      "/api/collections/c1/tracks/t1"
    );
  });

  it("keeps other users' resources under /users", () => {
    expect(endpoints.users.profile("u1")).toBe("/api/users/u1");
    expect(endpoints.users.follow("u1")).toBe("/api/users/u1/follow");
  });

  it("encodes dynamic segments so ids with slashes cannot escape the path", () => {
    expect(endpoints.collections.one("a/b")).toBe("/api/collections/a%2Fb");
    expect(endpoints.users.profile("a b")).toBe("/api/users/a%20b");
  });
});
