import type {
  CatalogSearchResult,
  CatalogSearchType,
  ProviderArtist,
  ProviderPlaylist,
  ProviderTrack,
} from "./types";

/**
 * The one seam between the app and whatever fetches catalog data. No route
 * handler, component, or store may import a provider package directly.
 *
 * The incumbent scraper rotted to a ~90% failure rate and its getVideo and
 * getPlaylist died outright, so a swap is a matter of when, not if.
 */
export interface CatalogProvider {
  search(
    query: string,
    opts: { type: CatalogSearchType; limit: number }
  ): Promise<CatalogSearchResult>;
  suggest(query: string): Promise<string[]>;
  getTrack(providerTrackId: string): Promise<ProviderTrack | null>;
  getTracks(providerTrackIds: string[]): Promise<ProviderTrack[]>;
  getArtist(artistId: string): Promise<ProviderArtist | null>;
  getRelatedTracks(providerTrackId: string): Promise<ProviderTrack[]>;
  getPlaylist(playlistId: string): Promise<ProviderPlaylist | null>;
}

let override: CatalogProvider | null = null;

/** Swap the provider in tests. Pass null to restore the real one. */
export function setCatalogProvider(p: CatalogProvider | null): void {
  override = p;
}

export async function getCatalogProvider(): Promise<CatalogProvider> {
  if (override) return override;
  // Imported lazily so the provider package never lands in a bundle that
  // only needed the types.
  const { YoutubeCatalogProvider } = await import("./youtube");
  return new YoutubeCatalogProvider();
}
