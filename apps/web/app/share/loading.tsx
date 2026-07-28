import Image from "next/image";
import Link from "next/link";

import SectionLabel from "@/components/studio/SectionLabel";
import { SkeletonCard, SkeletonRow } from "@/components/studio/Skeletons";
import { Button } from "@/components/ui/button";

export default function SharedMusicLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex shrink-0 items-center px-1">
            <Image
              src="/svgs/logo_light.svg"
              width={20}
              height={20}
              alt="Yukirhythm"
              className="h-5 w-auto object-contain"
            />
          </Link>
          <Button size="sm" asChild>
            <Link href="/auth">Open app</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[minmax(240px,360px)_minmax(0,1fr)] md:gap-12 md:py-14">
        <section className="mx-auto w-full max-w-[360px]">
          <SectionLabel>Loading shared music</SectionLabel>
          <SkeletonCard className="mt-3 w-full rounded-3xl" />
        </section>
        <section className="space-y-3">
          <SectionLabel>Track list</SectionLabel>
          <h1 className="type-h3">Tracks</h1>
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonRow key={index} />
          ))}
        </section>
      </main>
    </div>
  );
}
