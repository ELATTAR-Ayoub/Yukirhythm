import { beforeEach, describe, expect, it } from "vitest";
import {
  acknowledgeListens,
  clearSavedListens,
  localListeningStats,
  outboxKey,
  pendingListens,
  savedListens,
  storeListen,
  type LocalListen,
} from "./browser-history";

const listen = (id = "listen-123"): LocalListen => ({
  eventId: id,
  trackId: "song",
  collectionId: null,
  startedAt: Date.now(),
  listenedSec: 120,
  durationSec: 180,
  artists: [{ artistId: "artist", name: "Artist" }],
  labels: [],
  source: "search",
  recommendationId: null,
  clientHourOfDay: 9,
  track: {
    id: "song",
    title: "Song",
    artist: "Artist",
    durationSec: 180,
    texture: "tx-k-silk",
  },
});
beforeEach(() => localStorage.clear());
describe("durable browser history and upload outbox", () => {
  it("keeps a playable archive after the server acknowledges an upload", () => {
    storeListen("u", listen());
    acknowledgeListens("u", new Set(["listen-123"]));
    expect(pendingListens("u")).toEqual([]);
    expect(savedListens("u")[0].track?.title).toBe("Song");
    expect(localListeningStats(savedListens("u")).minutesAllTime).toBe(2);
  });
  it("does not remove a newer pending listen when an older request completes", () => {
    storeListen("u", listen("old"));
    storeListen("u", listen("new"));
    acknowledgeListens("u", new Set(["old"]));
    expect(pendingListens("u").map((e) => e.eventId)).toEqual(["new"]);
    expect(savedListens("u")).toHaveLength(2);
  });
  it("migrates pending-only history without losing it on acknowledgment", () => {
    localStorage.setItem(outboxKey("u"), JSON.stringify([listen()]));
    acknowledgeListens("u", new Set(["listen-123"]));
    expect(savedListens("u")).toHaveLength(1);
  });
  it("isolates users and clears both local copies", () => {
    storeListen("u", listen());
    storeListen("v", listen());
    clearSavedListens("u");
    expect(savedListens("u")).toEqual([]);
    expect(savedListens("v")).toHaveLength(1);
  });
  it("ignores corrupt browser records", () => {
    localStorage.setItem(outboxKey("u"), JSON.stringify([null, {}, "bad"]));
    expect(savedListens("u")).toEqual([]);
  });
});
