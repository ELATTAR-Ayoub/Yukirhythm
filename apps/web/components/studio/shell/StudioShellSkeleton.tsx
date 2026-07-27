"use client";

import { usePathname } from "next/navigation";

import {
  CreatePlaylistPageSkeleton,
  HomePageSkeleton,
  LibraryPageSkeleton,
  LibraryRailSkeleton,
  NowPlayingRailSkeleton,
  PlaybackBarSkeleton,
  PlaylistAddMusicPageSkeleton,
  PlaylistPageSkeleton,
  PrivacyPageSkeleton,
  ProfilePageSkeleton,
  ProfileViewPageSkeleton,
  QueueAddMusicPageSkeleton,
  QueuePageSkeleton,
  RecentsPageSkeleton,
  SearchPageSkeleton,
  SettingsPageSkeleton,
  StatsPageSkeleton,
} from "@/components/studio/screens/RouteSkeletons";

export function SkeletonForStudioPath({ pathname }: { pathname: string }) {
  if (pathname === "/home") return <HomePageSkeleton />;
  if (pathname === "/search") return <SearchPageSkeleton />;
  if (pathname === "/library") return <LibraryPageSkeleton />;
  if (pathname === "/create") return <CreatePlaylistPageSkeleton />;
  if (pathname === "/queue/add") return <QueueAddMusicPageSkeleton />;
  if (pathname === "/queue") return <QueuePageSkeleton />;
  if (/^\/playlist\/[^/]+\/add$/.test(pathname))
    return <PlaylistAddMusicPageSkeleton />;
  if (/^\/playlist\/[^/]+$/.test(pathname)) return <PlaylistPageSkeleton />;
  if (pathname === "/profile/view") return <ProfileViewPageSkeleton />;
  if (pathname === "/profile/settings") return <SettingsPageSkeleton />;
  if (pathname === "/profile/privacy") return <PrivacyPageSkeleton />;
  if (pathname === "/profile/stats") return <StatsPageSkeleton />;
  if (pathname === "/profile/recents") return <RecentsPageSkeleton />;
  if (pathname === "/profile") return <ProfilePageSkeleton />;
  return <HomePageSkeleton />;
}

/**
 * Full signed-in shell fallback used while Firebase restores its session.
 * Desktop mirrors the three-column shell; mobile keeps the rails hidden and
 * uses the route skeleton plus bottom player/navigation placeholders.
 */
export default function StudioShellSkeleton() {
  const pathname = usePathname() || "/home";

  return (
    <div className="flex h-screen flex-col overflow-hidden p-2 sm:p-6 md:gap-2 md:p-2">
      <div className="hidden h-[var(--shell-header-h)] shrink-0 items-center gap-3 px-3 md:flex">
        <div className="h-5 w-28 animate-pulse rounded-sm bg-muted" />
        <div className="flex flex-1 items-center justify-center gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-full max-w-[480px] animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
      </div>

      <div className="flex min-h-0 flex-1 md:gap-2">
        <aside className="hidden min-h-0 w-[var(--shell-rail-w)] shrink-0 overflow-hidden rounded-2xl border border-border bg-card md:block">
          <LibraryRailSkeleton />
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-[calc(var(--mobile-chrome-h)+0.5rem)] md:rounded-2xl md:border md:border-border md:bg-card md:px-6 md:py-6">
          <SkeletonForStudioPath pathname={pathname} />
        </main>

        <aside className="hidden min-h-0 w-[var(--shell-rail-w)] shrink-0 overflow-hidden rounded-2xl border border-border bg-card 3xl:block">
          <NowPlayingRailSkeleton />
        </aside>
      </div>

      <nav
        aria-label="Primary loading"
        className="fixed inset-x-2 bottom-0 z-40 h-[var(--bottom-nav-h)] p-2 md:hidden"
      >
        <div className="flex h-full animate-pulse items-center justify-around rounded-full border border-border bg-card/90">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-8 w-16 rounded-full bg-muted" />
          ))}
        </div>
      </nav>
      <PlaybackBarSkeleton mobile />
      <PlaybackBarSkeleton />
    </div>
  );
}
