"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import FeedShelf from "@/components/studio/screens/FeedShelf";
import { useCachedStudioFeed } from "@/components/studio/screens/useCachedStudioFeed";
import MediaCard from "@/components/studio/MediaCard";
import SearchTrackResults from "@/components/studio/screens/SearchTrackResults";
import EmptyState from "@/components/studio/EmptyState";
import Texture from "@/components/studio/Texture";
import CollectionArt from "@/components/studio/screens/CollectionArt";
import { SkeletonRow } from "@/components/studio/Skeletons";
import { Input } from "@/components/ui/input";
import SectionLabel from "@/components/studio/SectionLabel";
import PageHeader from "@/components/studio/screens/PageHeader";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "@/components/studio/shell/routes";
import { EXPLORE_TILES } from "@/components/studio/screens/mock-data";

export default function SearchScreen() {
  const {
    search,
    searchResults,
    searching,
    hasSearched,
    clearSearch,
    youMightLike,
    newReleases,
    feedsLoading,
    collectionResults,
    user,
  } = useMockStudio();
  const [q, setQ] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const suggestedFeed = useCachedStudioFeed({
    feed: "you-might-like",
    userId: user?.id ?? "anonymous",
    providerTracks: youMightLike,
    providerLoading: feedsLoading,
  });
  const newReleaseFeed = useCachedStudioFeed({
    feed: "new-releases",
    userId: user?.id ?? "anonymous",
    providerTracks: newReleases,
    providerLoading: feedsLoading,
  });

  // Typing only edits the field; the search fires on submit (Enter, or the
  // mobile keyboard's Search key). Emptying the field abandons the results.
  const onChange = (value: string) => {
    setQ(value);
    if (!value.trim()) {
      setSubmittedQuery("");
      clearSearch();
    }
  };

  /** One explicit act — Enter or a mood tile — is what runs a search. */
  const submit = (value: string) => {
    setQ(value);
    const query = value.trim();
    setSubmittedQuery(query);
    if (query) search(query);
    else clearSearch();
  };

  // Collection results come from the provider (the caller's own library), so
  // Liked Songs and anything the create wizard made are findable.
  const collectionHits = collectionResults;
  // Idle = no submitted search on foot. Editing the field around a submitted
  // search keeps its results on screen until the next submit or a clear.
  const idle = !hasSearched;

  return (
    <div>
      <PageHeader title="Search" />

      <form
        role="search"
        aria-label="Track search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className="relative mb-8"
      >
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder="Tracks, artists, collections…"
          aria-label="Search"
          className="pl-9"
        />
      </form>

      {idle ? (
        <div className="space-y-10">
          <FeedShelf
            label="For you"
            title="You might like"
            tracks={suggestedFeed.tracks}
            loading={suggestedFeed.loading}
            onRefresh={suggestedFeed.refresh}
            refreshing={suggestedFeed.refreshing}
          />

          <FeedShelf
            label="Fresh drops"
            title="New releases"
            tracks={newReleaseFeed.tracks}
            loading={newReleaseFeed.loading}
            onRefresh={newReleaseFeed.refresh}
            refreshing={newReleaseFeed.refreshing}
          />

          <section>
            <SectionLabel>Explore</SectionLabel>
            <h2 className="font-display font-bold text-2xl tracking-tight mt-0.5 mb-3">
              Browse by mood
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {EXPLORE_TILES.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => submit(tile.label)}
                  className="group relative h-24 rounded-lg overflow-hidden border border-border text-left hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
                >
                  <Texture
                    name={tile.texture}
                    className="absolute inset-0 w-full h-full"
                  />
                  <span className="absolute bottom-2 left-3 font-display font-bold text-snow drop-shadow">
                    {tile.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-8" aria-live="polite" aria-busy={searching}>
          {searching ? (
            <div className="space-y-1">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : (
            <>
              {searchResults.length > 0 ? (
                <SearchTrackResults
                  key={submittedQuery}
                  tracks={searchResults}
                />
              ) : null}

              {collectionHits.length > 0 ? (
                <section>
                  <SectionLabel>Collections</SectionLabel>
                  <div className="space-y-2 mt-2">
                    {collectionHits.map((c) => (
                      <Link
                        key={c.id}
                        href={playlistHref(c.id)}
                        aria-label={`Open ${c.title}`}
                        className="block w-full text-left"
                      >
                        {/* No play overlay: this card is an anchor, and
                            MediaCard's overlay would nest a button inside it. */}
                        <MediaCard
                          title={c.title}
                          artist={`${c.trackIds.length} tracks`}
                          art={
                            <CollectionArt
                              collection={c}
                              className="w-full h-full"
                            />
                          }
                          variant="extended"
                          size="sm"
                          playable={false}
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {hasSearched &&
              searchResults.length === 0 &&
              collectionHits.length === 0 ? (
                <EmptyState
                  title="No results"
                  hint="Try a different search — artist, title or tag."
                  texture="tx-k2-static"
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
