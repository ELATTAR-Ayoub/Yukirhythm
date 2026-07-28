import { ImageResponse } from "next/og";

import { getPublicTrack } from "@/lib/sharing/public";

export const runtime = "nodejs";
export const alt = "Shared Yukirhythm track";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SharedTrackImage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const track = await getPublicTrack(trackId);

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "linear-gradient(135deg, #0e1530 0%, #191919 52%, #102819 100%)",
        color: "#f7f6f3",
        display: "flex",
        height: "100%",
        padding: 64,
        width: "100%",
      }}
    >
      {track?.artUrl ? (
        // Catalog/provider-owned URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.artUrl}
          alt=""
          width={500}
          height={500}
          style={{
            borderRadius: 36,
            boxShadow: "0 30px 70px rgba(0,0,0,.5)",
            height: 500,
            objectFit: "cover",
            width: 500,
          }}
        />
      ) : (
        <div
          style={{
            background: "#1450f0",
            borderRadius: 36,
            display: "flex",
            height: 500,
            width: 500,
          }}
        />
      )}
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
          Shared track
        </div>
        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            lineHeight: 1.04,
            marginTop: 22,
          }}
        >
          {track?.title || "Listen on Yukirhythm"}
        </div>
        <div style={{ color: "#bdbdbd", fontSize: 30, marginTop: 24 }}>
          {track?.artist || "Music, shared beautifully."}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 54 }}>
          Yukirhythm.
        </div>
      </div>
    </div>,
    size
  );
}
