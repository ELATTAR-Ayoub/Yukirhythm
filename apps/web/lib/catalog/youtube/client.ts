import { Innertube } from "youtubei.js";

let clientPromise: Promise<Innertube> | null = null;

/**
 * One Innertube instance per process. Creation performs a network handshake,
 * so it is cached — and a failure clears the cache so the next call retries
 * rather than reusing a rejected promise forever.
 */
export function youtubeClient(): Promise<Innertube> {
  if (!clientPromise) {
    clientPromise = Innertube.create({ lang: "en", location: "US" }).catch(
      (e) => {
        clientPromise = null;
        throw e;
      }
    );
  }
  return clientPromise;
}
