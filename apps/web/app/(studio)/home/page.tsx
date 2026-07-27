"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BellIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import RailShelf from "@/components/studio/RailShelf";
import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import PageHeader from "@/components/studio/screens/PageHeader";
import CollectionArt from "@/components/studio/screens/CollectionArt";
import FeedShelf from "@/components/studio/screens/FeedShelf";
import { useCachedStudioFeed } from "@/components/studio/screens/useCachedStudioFeed";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { useIsDesktop } from "@/components/studio/shell/useBreakpoint";
import { playlistHref } from "@/components/studio/shell/routes";

export default function HomeScreen() {
  const {
    user,
    collections,
    libraryLoading,
    jumpBackIn,
    newReleases,
    youMightLike,
    jumpBackInLoading,
    newReleasesLoading,
    youMightLikeLoading,
  } = useMockStudio();
  const isDesktop = useIsDesktop();
  const newReleaseFeed = useCachedStudioFeed({
    feed: "new-releases",
    userId: user?.id ?? "anonymous",
    providerTracks: newReleases,
    providerLoading: newReleasesLoading,
  });
  const suggestedFeed = useCachedStudioFeed({
    feed: "you-might-like",
    userId: user?.id ?? "anonymous",
    providerTracks: youMightLike,
    providerLoading: youMightLikeLoading,
  });
  const recentCollections = useMemo(() => {
    const likedSongs = collections.find(
      (collection) => collection.system || collection.id === "liked"
    );
    const candidates = likedSongs ? [likedSongs, ...jumpBackIn] : jumpBackIn;
    return candidates.filter(
      (collection, index, all) =>
        all.findIndex((candidate) => candidate.id === collection.id) === index
    );
  }, [collections, jumpBackIn]);
  const recentShelfLoading =
    jumpBackInLoading || (libraryLoading && recentCollections.length === 0);
  /**
   * MediaCard is a fixed-width scroller card (`BOXY_WIDTHS`) by default. The
   * shelves below opt into RailShelf's grid, which only actually activates
   * once `isDesktop` is true — mirror that same condition here so the card
   * fills its grid cell (matching CollectionDetail's grid view) exactly when,
   * and only when, the shelf itself is actually in grid shape.
   */
  const shelfCardClassName = isDesktop ? "w-full" : undefined;

  return (
    <div>
      <PageHeader
        title="Home"
        actions={
          <PlayerButton
            variant="ghost"
            aria-label="Notifications"
            onClick={() => toast("No new notifications")}
          >
            <BellIcon />
          </PlayerButton>
        }
      />

      <div className="space-y-10">
        {user && (recentShelfLoading || recentCollections.length > 0) ? (
          <RailShelf
            label="Recently played"
            title="Jump back in"
            loading={recentShelfLoading}
            grid
          >
            {recentCollections.map((c) => (
              <Link
                key={c.id}
                href={playlistHref(c.id)}
                aria-label={`Open ${c.title}`}
                className="block text-left shrink-0"
              >
                {/* No play overlay: this card is an anchor, and MediaCard's
                    overlay would nest a button inside it. */}
                <MediaCard
                  title={c.title}
                  artist={`${c.trackIds.length} tracks`}
                  art={
                    <CollectionArt collection={c} className="w-full h-full" />
                  }
                  size="sm"
                  playable={false}
                  className={shelfCardClassName}
                />
              </Link>
            ))}
          </RailShelf>
        ) : null}

        <FeedShelf
          label="Fresh drops"
          title="New releases"
          tracks={newReleaseFeed.tracks}
          loading={newReleaseFeed.loading}
          onRefresh={newReleaseFeed.refresh}
          refreshing={newReleaseFeed.refreshing}
          grid
          size="md"
          cardClassName={shelfCardClassName}
        />

        <FeedShelf
          label="For you"
          title="You might like"
          tracks={suggestedFeed.tracks}
          loading={suggestedFeed.loading}
          onRefresh={suggestedFeed.refresh}
          refreshing={suggestedFeed.refreshing}
          grid
          size="md"
          cardClassName={shelfCardClassName}
        />
      </div>
    </div>
  );
}
