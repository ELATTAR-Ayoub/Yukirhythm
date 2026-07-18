import type { Metadata, Viewport } from "next";

// styles
import "./globals.css";
import styles from "@/styles/index";
import { fontVariables } from "./fonts";

// providers (client)
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Yukirhythm",
  description:
    "Yukirhythm — a music and podcast player that finds and plays content from YouTube based on your searches.",
  icons: { icon: "/icon" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body
        className={` ${styles.flexStart} flex-col relative bg-background h-screen overflow-x-hidden`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
