import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/lib/catalog/model";
import { createGuestBackend } from "./guest-backend";
import { savedListens, storeListen } from "./browser-history";
import {
  activeGuestId,
  endGuestSession,
  startGuestSession,
} from "./guest-session";

const track = (id: string): Track => ({
  trackId: id,
  title: `Song ${id}`,
  artists: [{ artistId: "a", name: "Artist" }],
  album: null,
  durationSec: 120,
  artwork: [],
  texture: "tx-k-silk",
  source: {
    provider: "youtube",
    videoId: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    aliasVideoIds: [],
  },
  type: "track",
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  stats: { viewCount: 0, likeCount: 0, playCount: 0 },
  labels: [],
  labelIds: [],
  keywords: [],
  publishedAt: null,
  enrichedAt: null,
  schemaVersion: 1,
});
let uid: string;
let backend: ReturnType<typeof createGuestBackend>;
const network = vi.fn();
beforeEach(() => {
  localStorage.clear();
  startGuestSession();
  uid = activeGuestId()!;
  backend = createGuestBackend(uid);
  network.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ tracks: [track("one"), track("two")] }),
  });
  vi.stubGlobal("fetch", network);
});

describe("guest device persistence", () => {
  it("keeps history and stats on the device and clears history without removing likes", async () => {
    await backend.catalog.search("music");
    await backend.me.setTrackState("one", { isLiked: true });
    const event = {
      eventId: "guest-listen",
      trackId: "one",
      collectionId: null,
      startedAt: Date.now(),
      listenedSec: 60,
      durationSec: 120,
      artists: track("one").artists,
      labels: [],
      source: "search" as const,
      recommendationId: null,
      clientHourOfDay: 9,
    };
    storeListen(uid, event);
    network.mockClear();
    await backend.events.ingest([event]);
    expect(savedListens(uid)).toHaveLength(1);
    expect((await backend.me.stats()).minutesAllTime).toBe(1);
    expect((await backend.me.recents()).items[0].startedAtMs).toBe(
      event.startedAt
    );
    await backend.me.clearHistory();
    expect(savedListens(uid)).toEqual([]);
    expect((await backend.me.likes()).trackIds).toEqual(["one"]);
    expect(network).not.toHaveBeenCalled();
  });
  it("keeps likes, playlist membership, pins and preferences through reload and guest re-entry with zero personal HTTP", async () => {
    await backend.catalog.search("songs");
    expect(network).toHaveBeenCalledTimes(1);
    expect(network.mock.calls[0][0]).toMatch(/^\/api\/guest\/catalog\?/);
    network.mockClear();
    await backend.me.ensure({});
    await backend.me.setTrackState("one", { isLiked: true });
    const collection = await backend.collections.create({
      title: "Device mix",
      tracks: [{ trackId: "one" } as never],
    });
    await backend.collections.addTrack(collection.collectionId, "two");
    await backend.collections.reorder(collection.collectionId, ["two", "one"]);
    await backend.me.setPin(collection.collectionId, { isPinned: true });
    await backend.me.update({ privacy: { saveHistory: false } });
    endGuestSession();
    startGuestSession();
    expect(activeGuestId()).toBe(uid);
    const restored = createGuestBackend(uid);
    expect((await restored.me.get())?.authProvider).toBe("guest");
    expect((await restored.me.get())?.privacy.saveHistory).toBe(false);
    expect((await restored.me.likes()).trackIds).toEqual(["one"]);
    expect((await restored.collections.list())[0].isPinned).toBe(true);
    expect(
      (await restored.collections.get(collection.collectionId)).tracks.map(
        (t) => t.trackId
      )
    ).toEqual(["two", "one"]);
    expect((await restored.me.library("Device")).collections).toHaveLength(1);
    await restored.collections.removeTrack(collection.collectionId, "one");
    await restored.me.setTrackState("one", { isLiked: false });
    expect((await restored.me.likes()).trackIds).toEqual([]);
    await restored.collections.remove(collection.collectionId);
    expect(await restored.collections.list()).toEqual([]);
    expect(network).not.toHaveBeenCalled();
  });
  it("does not let delayed catalog responses overwrite newer edits", async () => {
    await backend.catalog.search("initial");
    let resolve!: (value: unknown) => void;
    network.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    const pending = backend.catalog.search("later");
    await backend.me.setTrackState("one", { isLiked: true });
    await backend.collections.create({ title: "Keep me" });
    resolve({ ok: true, json: async () => ({ tracks: [track("three")] }) });
    await pending;
    expect((await backend.me.likes()).trackIds).toEqual(["one"]);
    expect(await backend.collections.list()).toHaveLength(1);
  });
  it("fences an ended guest session and rejects public sharing", async () => {
    const c = await backend.collections.create({ title: "Private" });
    await expect(
      backend.collections.update(c.collectionId, { visibility: "public" })
    ).rejects.toMatchObject({ status: 403 });
    await expect(backend.users.follow("someone")).rejects.toMatchObject({
      status: 403,
    });
    endGuestSession();
    await expect(backend.me.get()).rejects.toMatchObject({ status: 401 });
    expect(network).not.toHaveBeenCalled();
  });
  it("preserves corrupt records and reports storage write failures", async () => {
    const key = `yukirhythm:guest-data:v1:${uid}`;
    localStorage.setItem(key, "corrupt");
    await expect(backend.me.ensure({})).rejects.toThrow(
      "has not been overwritten"
    );
    expect(localStorage.getItem(key)).toBe("corrupt");
    localStorage.removeItem(key);
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    await expect(
      backend.collections.create({ title: "No room" })
    ).rejects.toMatchObject({ status: 507 });
    spy.mockRestore();
  });
  it("does not acknowledge failed or duplicate reorders as saved", async () => {
    await backend.catalog.search("songs");
    const c = await backend.collections.create({
      title: "Order",
      tracks: [{ trackId: "one" } as never, { trackId: "two" } as never],
    });
    await expect(
      backend.collections.reorder(c.collectionId, ["one", "one"])
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (await backend.collections.get(c.collectionId)).tracks.map(
        (t) => t.trackId
      )
    ).toEqual(["one", "two"]);
  });
});
