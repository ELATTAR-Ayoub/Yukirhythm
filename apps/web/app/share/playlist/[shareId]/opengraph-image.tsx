import { ImageResponse } from "next/og";

import { getPublicPlaylist } from "@/lib/sharing/public";

export const runtime = "nodejs";
export const alt = "Shared Yukirhythm playlist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SharedPlaylistImage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const playlist = await getPublicPlaylist(shareId);
  const art = playlist?.artUrls ?? [];

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "linear-gradient(135deg, #111d3d 0%, #191919 52%, #102819 100%)",
        color: "#f7f6f3",
        display: "flex",
        height: "100%",
        padding: 64,
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#242424",
          borderRadius: 36,
          boxShadow: "0 30px 70px rgba(0,0,0,.5)",
          display: "flex",
          flexWrap: "wrap",
          height: 500,
          overflow: "hidden",
          width: 500,
        }}
      >
        {Array.from({ length: 4 }, (_, index) => {
          const src = art[index] ?? art[0];
          return src ? (
            // Catalog/provider-owned URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${src}-${index}`}
              src={src}
              alt=""
              width={250}
              height={250}
              style={{ height: 250, objectFit: "cover", width: 250 }}
            />
          ) : (
            <div
              key={index}
              style={{
                background: index % 2 ? "#1450f0" : "#7df08a",
                display: "flex",
                height: 250,
                opacity: index > 1 ? 0.72 : 1,
                width: 250,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: 58,
          maxWidth: 510,
        }}
      >
        <div
          style={{
            color: "#7df08a",
            fontSize: 24,
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          Shared playlist
        </div>
        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            lineHeight: 1.04,
            marginTop: 22,
          }}
        >
          {playlist?.title || "Listen on Yukirhythm"}
        </div>
        <div style={{ color: "#bdbdbd", fontSize: 30, marginTop: 24 }}>
          {playlist
            ? `${playlist.tracks.length} ${playlist.tracks.length === 1 ? "track" : "tracks"} by ${playlist.ownerName}`
            : "Music, shared beautifully."}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 54 }}>
          Yukirhythm.
        </div>
      </div>
    </div>,
    size
  );
}
