import { cn } from "@/lib/utils";
import { SkeletonCard, SkeletonRow } from "@/components/studio/Skeletons";

function LoadingFrame({
  name,
  children,
  className,
}: {
  name: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={`${name} loading`}
      aria-busy="true"
      className={cn("w-full animate-pulse", className)}
    >
      <span className="sr-only">Loading {name}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

function Bar({
  className,
  muted = false,
}: {
  className: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm",
        muted ? "bg-muted/60" : "bg-muted",
        className
      )}
    />
  );
}

function PageHeading({
  title,
  action = false,
}: {
  title: string;
  action?: boolean;
}) {
  return (
    <div className="mb-8 flex min-h-10 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Bar className="h-10 w-10 shrink-0 rounded-full md:hidden" />
        <h1 className="type-h2 truncate text-2xl sm:text-3xl">{title}</h1>
      </div>
      {action ? <Bar className="h-9 w-9 rounded-full" /> : null}
    </div>
  );
}

function BackHeading({ title }: { title: string }) {
  return (
    <div className="mb-8 flex min-h-10 items-center gap-3">
      <Bar className="h-10 w-10 shrink-0 rounded-full" />
      <h1 className="type-h2 truncate text-2xl sm:text-3xl">{title}</h1>
    </div>
  );
}

function ShelfShape({
  cards = 5,
  label,
  title,
}: {
  cards?: number;
  label?: string;
  title?: string;
}) {
  return (
    <section aria-label={title ? `${title} loading` : undefined}>
      {label && title ? (
        <>
          <p className="font-label text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <h2 className="mt-0.5 font-display text-2xl font-bold tracking-tight">
            {title}
          </h2>
        </>
      ) : (
        <>
          <Bar className="h-2.5 w-20" />
          <Bar className="mt-2 h-6 w-40" />
        </>
      )}
      <div className="mt-4 flex gap-4 overflow-hidden">
        {Array.from({ length: cards }, (_, index) => (
          <SkeletonCard
            key={index}
            className="w-36 sm:w-40 lg:w-[calc(25%-0.75rem)]"
          />
        ))}
      </div>
    </section>
  );
}

function RowList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}

function MenuRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
        >
          <Bar className="h-8 w-8 rounded-md" />
          <div className="min-w-0 flex-1">
            <Bar className="h-3.5 w-32" />
            <Bar className="mt-2 h-2.5 w-48 max-w-full" muted />
          </div>
          <Bar className="h-4 w-4" muted />
        </div>
      ))}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <LoadingFrame name="Home page">
      <PageHeading title="Home" action />
      <div className="space-y-10">
        <ShelfShape label="Recently played" title="Jump back in" cards={4} />
        <ShelfShape label="Fresh drops" title="New releases" />
        <ShelfShape label="For you" title="You might like" />
      </div>
    </LoadingFrame>
  );
}

export function SearchPageSkeleton() {
  return (
    <LoadingFrame name="Search page">
      <PageHeading title="Search" />
      <Bar className="mb-8 h-11 w-full rounded-full" />
      <div className="space-y-10">
        <ShelfShape label="Fresh drops" title="New releases" />
        <ShelfShape label="For you" title="You might like" />
        <section>
          <Bar className="h-2.5 w-16" />
          <Bar className="mt-2 h-6 w-44" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Bar key={index} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </section>
      </div>
    </LoadingFrame>
  );
}

export function LibraryPageSkeleton() {
  return (
    <LoadingFrame name="Library page">
      <PageHeading title="Your Library" action />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Bar key={index} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <RowList rows={6} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Bar className="h-16 w-full rounded-lg" />
        <Bar className="h-16 w-full rounded-lg" />
      </div>
    </LoadingFrame>
  );
}

export function PlaylistPageSkeleton() {
  return (
    <LoadingFrame name="Playlist page">
      <BackHeading title="Playlist" />
      <div className="grid gap-5 sm:grid-cols-[11rem_1fr] sm:items-end">
        <Bar className="aspect-square w-40 rounded-lg sm:w-44" />
        <div>
          <Bar className="h-3 w-20" />
          <Bar className="mt-3 h-8 w-56 max-w-full" />
          <Bar className="mt-3 h-3 w-72 max-w-full" muted />
          <div className="mt-5 flex gap-2">
            <Bar className="h-11 w-11 rounded-full" />
            <Bar className="h-11 w-11 rounded-full" />
            <Bar className="h-11 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <div className="my-6 flex justify-between gap-3">
        <Bar className="h-9 w-28 rounded-full" />
        <Bar className="h-9 w-20 rounded-full" />
      </div>
      <RowList rows={7} />
    </LoadingFrame>
  );
}

function AddMusicPageSkeleton({
  name,
  targetWidth,
}: {
  name: string;
  targetWidth: string;
}) {
  return (
    <LoadingFrame name={name}>
      <BackHeading title="Search songs" />
      <Bar className={cn("-mt-4 mb-5 h-3", targetWidth)} muted />
      <Bar className="h-11 w-full rounded-full" />
      <div className="mt-4">
        <RowList rows={7} />
      </div>
    </LoadingFrame>
  );
}

export function PlaylistAddMusicPageSkeleton() {
  return (
    <AddMusicPageSkeleton name="Playlist add music page" targetWidth="w-48" />
  );
}

export function QueueAddMusicPageSkeleton() {
  return (
    <AddMusicPageSkeleton name="Queue add music page" targetWidth="w-32" />
  );
}

export function CreatePlaylistPageSkeleton() {
  return (
    <LoadingFrame name="Create playlist page" className="flex h-full flex-col">
      <BackHeading title="Create playlist" />
      <div className="mx-auto w-full max-w-2xl flex-1">
        <div className="mb-7 flex items-center justify-center gap-2">
          <Bar className="h-2 w-20 rounded-full" />
          <Bar className="h-2 w-20 rounded-full" muted />
          <Bar className="h-2 w-20 rounded-full" muted />
        </div>
        <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
          <Bar className="aspect-square w-48 max-w-full rounded-lg" />
          <div className="space-y-5">
            <div>
              <Bar className="h-3 w-24" />
              <Bar className="mt-2 h-11 w-full rounded-md" />
            </div>
            <div>
              <Bar className="h-3 w-28" />
              <Bar className="mt-2 h-24 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <Bar className="h-10 w-24 rounded-full" muted />
        <Bar className="h-10 w-28 rounded-full" />
      </div>
    </LoadingFrame>
  );
}

export function QueuePageSkeleton() {
  return (
    <LoadingFrame name="Queue page">
      <BackHeading title="Up next" />
      <div className="mb-6 flex items-center gap-4 rounded-lg border border-border p-4">
        <Bar className="h-20 w-20 rounded-md" />
        <div className="flex-1">
          <Bar className="h-6 w-32" />
          <Bar className="mt-2 h-3 w-24" muted />
        </div>
        <Bar className="h-11 w-11 rounded-full" />
      </div>
      <RowList rows={8} />
    </LoadingFrame>
  );
}

export function ProfilePageSkeleton() {
  return (
    <LoadingFrame name="Profile page">
      <PageHeading title="Profile" />
      <div className="mb-6 flex items-center gap-4 rounded-lg border border-border p-4">
        <Bar className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <Bar className="h-5 w-36" />
          <Bar className="mt-2 h-3 w-48 max-w-full" muted />
        </div>
      </div>
      <MenuRows />
    </LoadingFrame>
  );
}

export function ProfileViewPageSkeleton() {
  return (
    <LoadingFrame name="Profile view page">
      <BackHeading title="Your profile" />
      <div className="flex flex-col items-center py-6">
        <Bar className="h-24 w-24 rounded-full" />
        <Bar className="mt-4 h-7 w-40" />
        <Bar className="mt-3 h-3 w-52" muted />
        <Bar className="mt-3 h-2.5 w-28" muted />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Bar key={index} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </LoadingFrame>
  );
}

export function SettingsPageSkeleton() {
  return (
    <LoadingFrame name="Settings page">
      <BackHeading title="Settings" />
      <div className="space-y-8">
        <section>
          <Bar className="h-2.5 w-20" />
          <div className="mt-2">
            <MenuRows rows={3} />
          </div>
        </section>
        <section>
          <Bar className="h-2.5 w-16" />
          <div className="mt-2">
            <MenuRows rows={1} />
          </div>
        </section>
        <Bar className="h-10 w-full rounded-md" />
      </div>
    </LoadingFrame>
  );
}

export function PrivacyPageSkeleton() {
  return (
    <LoadingFrame name="Privacy page">
      <BackHeading title="Privacy" />
      <Bar className="h-3 w-full max-w-lg" muted />
      <Bar className="mt-2 h-3 w-4/5 max-w-md" muted />
      <div className="mt-6">
        <MenuRows rows={3} />
      </div>
      <Bar className="mt-6 h-10 w-full rounded-md" />
    </LoadingFrame>
  );
}

export function StatsPageSkeleton() {
  return (
    <LoadingFrame name="Listening stats page">
      <BackHeading title="Listening stats" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Bar key={index} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <div className="mt-10 space-y-8">
        <section>
          <Bar className="h-2.5 w-20" />
          <div className="mt-2">
            <MenuRows rows={4} />
          </div>
        </section>
        <section>
          <Bar className="h-2.5 w-16" />
          <div className="mt-2">
            <RowList rows={5} />
          </div>
        </section>
        <div className="flex h-24 items-end gap-1">
          {Array.from({ length: 24 }, (_, index) => (
            <Bar
              key={index}
              className={cn(
                "flex-1",
                index % 3 === 0 ? "h-20" : index % 2 === 0 ? "h-12" : "h-7"
              )}
            />
          ))}
        </div>
      </div>
    </LoadingFrame>
  );
}

export function RecentsPageSkeleton() {
  return (
    <LoadingFrame name="Recents page">
      <BackHeading title="Recents" />
      <div className="space-y-8">
        {Array.from({ length: 3 }, (_, sectionIndex) => (
          <section key={sectionIndex}>
            <Bar className="h-2.5 w-20" />
            <div className="mt-2">
              <RowList rows={sectionIndex === 0 ? 4 : 3} />
            </div>
          </section>
        ))}
      </div>
    </LoadingFrame>
  );
}

export function AuthPageSkeleton() {
  return (
    <LoadingFrame name="Authentication page" className="p-2 sm:p-6">
      <div className="flex min-h-[calc(100vh-1rem)] items-center justify-center rounded-lg border border-border bg-card/50 p-6 sm:min-h-[calc(100vh-3rem)]">
        <div className="flex w-full max-w-[400px] flex-col items-center">
          <Bar className="h-8 w-28 rounded-md" />
          <h1 className="type-h1 mt-5 text-center">Listen your way</h1>
          <Bar className="mt-4 h-3 w-72 max-w-full" muted />
          <div className="mt-7 w-full space-y-3">
            <Bar className="h-11 w-full rounded-full" />
            <Bar className="h-11 w-full rounded-full" />
          </div>
          <Bar className="mt-6 h-3 w-64 max-w-full" muted />
        </div>
      </div>
    </LoadingFrame>
  );
}

export function CreditsPageSkeleton() {
  return (
    <LoadingFrame
      name="Credits page"
      className="flex min-h-screen items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        <h1 className="type-h1 mb-6">Credits</h1>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <Bar className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Bar className="h-4 w-32" />
              <Bar className="mt-2 h-3 w-44" muted />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Bar key={index} className="h-7 w-16 rounded-full" />
            ))}
          </div>
          <Bar className="mt-6 h-3 w-48" muted />
          <Bar className="mt-3 h-3 w-full" muted />
        </div>
      </div>
    </LoadingFrame>
  );
}

export function TermsPageSkeleton() {
  return (
    <LoadingFrame name="Terms page" className="mx-auto max-w-6xl p-2 sm:p-6">
      <div className="max-w-xl">
        <BackHeading title="Terms" />
        <Bar className="h-3 w-full" muted />
        <Bar className="mt-2 h-3 w-4/5" muted />
        <div className="mt-8 space-y-7">
          {Array.from({ length: 5 }, (_, index) => (
            <section key={index}>
              <Bar className="h-2.5 w-8" />
              <Bar className="mt-2 h-5 w-40" />
              <Bar className="mt-3 h-3 w-full" muted />
              <Bar className="mt-2 h-3 w-5/6" muted />
            </section>
          ))}
        </div>
      </div>
    </LoadingFrame>
  );
}

export function RootPageSkeleton() {
  return (
    <LoadingFrame name="App entry page" className="p-2 sm:p-6">
      <div className="flex min-h-[calc(100vh-1rem)] flex-col rounded-lg border border-border bg-card/50 p-6 sm:min-h-[calc(100vh-3rem)]">
        <h1 className="font-display text-2xl font-bold">Yukirhythm</h1>
        <div className="m-auto flex w-full max-w-xl flex-col items-center">
          <Bar className="h-10 w-64 max-w-full" />
          <Bar className="mt-4 h-3 w-80 max-w-full" muted />
          <Bar className="mt-8 h-11 w-40 rounded-full" />
        </div>
      </div>
    </LoadingFrame>
  );
}

export function LibraryRailSkeleton() {
  return (
    <LoadingFrame name="Library sidebar" className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <h2 className="type-h3">Your Library</h2>
        <Bar className="h-9 w-9 rounded-full" />
      </div>
      <div className="mt-5 flex gap-2">
        <Bar className="h-8 w-20 rounded-full" />
        <Bar className="h-8 w-20 rounded-full" />
      </div>
      <div className="mt-5 flex-1 space-y-3 overflow-hidden">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Bar className="h-12 w-12 rounded-md" />
            <div className="flex-1">
              <Bar className="h-3.5 w-28" />
              <Bar className="mt-2 h-2.5 w-20" muted />
            </div>
          </div>
        ))}
      </div>
    </LoadingFrame>
  );
}

export function NowPlayingRailSkeleton() {
  return (
    <LoadingFrame name="Now playing sidebar" className="p-4">
      <Bar className="aspect-square w-full rounded-[2.75rem]" />
      <Bar className="mx-auto mt-5 h-5 w-36" />
      <Bar className="mx-auto mt-3 h-3 w-24" muted />
      <Bar className="mt-5 h-1 w-full rounded-full" />
      <div className="mt-6 flex justify-center gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Bar key={index} className="h-9 w-9 rounded-full" />
        ))}
      </div>
      <Bar className="mt-8 h-2.5 w-16" />
      <div className="mt-3">
        <RowList rows={3} />
      </div>
    </LoadingFrame>
  );
}

export function PlaybackBarSkeleton({ mobile = false }: { mobile?: boolean }) {
  return (
    <LoadingFrame
      name={mobile ? "Mobile player" : "Desktop player"}
      className={cn(
        "border border-border bg-card",
        mobile
          ? "fixed inset-x-2 bottom-[calc(var(--bottom-nav-h)+0.5rem)] z-40 h-16 w-auto rounded-lg p-2 md:hidden"
          : "hidden h-[var(--playback-bar-h)] rounded-2xl px-4 py-3 md:block"
      )}
    >
      <div className="flex h-full items-center gap-3">
        <Bar className="h-10 w-10 rounded-md" />
        <div className="w-32">
          <Bar className="h-3 w-28" />
          <Bar className="mt-2 h-2.5 w-20" muted />
        </div>
        <div className="flex flex-1 items-center justify-center gap-3">
          <Bar className="h-8 w-8 rounded-full" />
          <Bar className="h-9 w-9 rounded-full" />
          <Bar className="h-8 w-8 rounded-full" />
        </div>
        <Bar className="hidden h-1 w-40 rounded-full sm:block" />
      </div>
    </LoadingFrame>
  );
}
