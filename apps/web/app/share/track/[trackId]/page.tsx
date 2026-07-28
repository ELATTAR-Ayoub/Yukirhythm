import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { sharedTrackHref } from "@/components/studio/shell/routes";
import PublicListenClient from "@/components/sharing/PublicListenClient";
import { getPublicTrack, type PublicPlaylist } from "@/lib/sharing/public";
import { absoluteRequestUrl } from "@/lib/sharing/request-url";

export const runtime = "nodejs";

type Props = { params: Promise<{ trackId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trackId } = await params;
  const track = await getPublicTrack(trackId);
  if (!track) return { title: "Track not found | Yukirhythm" };

  const description = `Listen to ${track.title} by ${track.artist} on Yukirhythm. No account required.`;
  const image = await absoluteRequestUrl(
    `${sharedTrackHref(track.id)}/opengraph-image`
  );
  return {
    title: `${track.title} by ${track.artist} | Yukirhythm`,
    description,
    alternates: { canonical: sharedTrackHref(track.id) },
    openGraph: {
      type: "website",
      siteName: "Yukirhythm",
      title: track.title,
      description,
      images: [{ url: image, alt: `${track.title} artwork` }],
    },
    twitter: {
      card: "summary_large_image",
      title: track.title,
      description,
      images: [image],
    },
  };
}

export default async function SharedTrackPage({ params }: Props) {
  const { trackId } = await params;
  const track = await getPublicTrack(trackId);
  if (!track) notFound();

  const playlist: PublicPlaylist = {
    id: track.id,
    title: track.title,
    description: `Listen to ${track.title} by ${track.artist}.`,
    ownerName: track.artist,
    tags: ["shared track"],
    cover: track.artUrl ? "image" : "texture",
    artUrl: track.artUrl,
    artUrls: track.artUrl ? [track.artUrl] : [],
    texture: track.texture,
    tracks: [track],
  };

  return <PublicListenClient playlist={playlist} kind="track" />;
}
