const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Preserve case: YouTube video IDs are case-sensitive. */
export function youtubeVideoId(input: string): string | null {
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const path = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be" || host === "www.youtu.be") {
      if (path.length === 1) id = path[0];
    } else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      if (path.length === 1 && path[0] === "watch")
        id = url.searchParams.get("v");
      else if (
        path.length === 2 &&
        ["shorts", "embed", "live", "v"].includes(path[0])
      )
        id = path[1];
    }
    return id && VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Text queries may share case-folded caches; exact video lookups must not. */
export function catalogSearchKey(query: string): string {
  const id = youtubeVideoId(query);
  return id ? `video:${id}` : `text:${query.trim().toLocaleLowerCase()}`;
}
