import type { NextApiRequest, NextApiResponse } from "next";
import type { Audio } from "@/constants/interfaces";
import { validateSearchRequest, formatVideos } from "@/lib/search/format";
import { makeCacheKey, TtlCache } from "@/lib/search/cache";

// The package's shipped type declarations use `export = Exports` where
// `Exports` is a bare interface (no merged value/namespace/class). Under
// TypeScript that produces a type-only binding no matter which import form
// is used (`import x from ...`, `import * as x from ...`, or
// `import x = require(...)`) - see TS2693 "only refers to a type, but is
// being used as a value here". We fall back to a plain `require` with an
// explicit local type for the two functions we actually call.
const youtube = require("@fabricio-191/youtube") as {
  setDefaultOptions(options: {
    language?: string;
    location?: string;
    quantity?: number | "all";
    requestsOptions?: Record<string, unknown>;
  }): {
    search(query: string): Promise<{ results: any[] }>;
  };
};

const { search } = youtube.setDefaultOptions({
  language: "en",
  location: "US",
  quantity: "all",
  requestsOptions: {},
});

const CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 10_000;
const cache = new TtlCache<Audio[]>(CACHE_TTL_MS);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

type SearchResponse = Audio[] | { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const validation = validateSearchRequest(req.body ?? {});
  if (!validation.ok) {
    return res.status(400).json({ message: validation.error });
  }
  const { string, quantity } = validation.value;
  const key = makeCacheKey(string, quantity);

  const cached = cache.get(key);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const data: any = await withTimeout(search(string), SEARCH_TIMEOUT_MS);
    const results = data?.results ?? [];
    const audios = formatVideos(results, quantity);
    if (audios.length === 0) {
      return res.status(404).json({ message: "No results found" });
    }
    cache.set(key, audios);
    return res.status(200).json(audios);
  } catch (error) {
    const message = (error as Error).message;
    if (message === "timeout") {
      return res.status(504).json({ message: "Search timed out, try again" });
    }
    console.error("Search error:", message);
    return res
      .status(502)
      .json({ message: "Search is temporarily unavailable" });
  }
}
