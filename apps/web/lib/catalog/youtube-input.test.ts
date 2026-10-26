import { describe, expect, it } from "vitest";
import { catalogSearchKey, youtubeVideoId } from "./youtube-input";
const id = "a5uQMwRMHcs";
describe("YouTube search input", () => {
  it.each([
    id,
    `  ${id}  `,
    `https://www.youtube.com/watch?v=${id}&list=PLtest&t=42`,
    `https://music.youtube.com/watch?v=${id}&si=share`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=share&t=42`,
    `youtu.be/${id}`,
    `youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://youtube.com/live/${id}`,
    "_-AbCd01234",
  ])("extracts an exact case-sensitive ID from %s", (input) => {
    expect(youtubeVideoId(input)).toBe(input === "_-AbCd01234" ? input : id);
  });
  it.each([
    "daft punk instant crush",
    "",
    "a5uQMwRMHc",
    "a5uQMwRMHcsX",
    `https://example.com/watch?v=${id}`,
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://youtube.com@evil.test/watch?v=${id}`,
    `https://youtube.com/playlist?list=${id}`,
    `https://youtu.be/${id}/other`,
    `ftp://youtube.com/watch?v=${id}`,
    "https://youtube.com/watch?v=not-an-id",
  ])("keeps non-video input as ordinary text: %s", (input) => {
    expect(youtubeVideoId(input)).toBeNull();
  });
  it("canonicalizes URL forms without folding video ID case in cache keys", () => {
    expect(catalogSearchKey(id)).toBe(
      catalogSearchKey(`https://youtu.be/${id}?t=1`)
    );
    expect(catalogSearchKey(id)).not.toBe(catalogSearchKey(id.toLowerCase()));
    expect(catalogSearchKey("Daft Punk")).toBe(catalogSearchKey("daft punk"));
  });
});
