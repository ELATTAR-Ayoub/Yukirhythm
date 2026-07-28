import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { sharedPlaylistHref } from "@/components/studio/shell/routes";
import PublicListenClient from "@/components/sharing/PublicListenClient";
import { getPublicPlaylist } from "@/lib/sharing/public";
import { absoluteRequestUrl } from "@/lib/sharing/request-url";

export const runtime = "nodejs";

type Props = { params: Promise<{ shareId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const playlist = await getPublicPlaylist(shareId);
  if (!playlist) return { title: "Playlist not found | Yukirhythm" };

  const description =
    playlist.description ||
    `Listen to ${playlist.title}, shared by ${playlist.ownerName}, on Yukirhythm. No account required.`;
  const image = await absoluteRequestUrl(
    `${sharedPlaylistHref(playlist.id)}/opengraph-image`
  );
  return {
    title: `${playlist.title} | Yukirhythm`,
    description,
    alternates: { canonical: sharedPlaylistHref(playlist.id) },
    openGraph: {
      type: "website",
      siteName: "Yukirhythm",
      title: playlist.title,
      description,
      images: [{ url: image, alt: `${playlist.title} artwork` }],
    },
    twitter: {
      card: "summary_large_image",
      title: playlist.title,
      description,
      images: [image],
    },
  };
}

export default async function SharedPlaylistPage({ params }: Props) {
  const { shareId } = await params;
  const playlist = await getPublicPlaylist(shareId);
  if (!playlist) notFound();
  return <PublicListenClient playlist={playlist} kind="playlist" />;
}
