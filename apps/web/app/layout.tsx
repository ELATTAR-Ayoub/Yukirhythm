import type { Metadata, Viewport } from "next";

// styles
import "./globals.css";
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
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* No-FOUC theme init — same `theme` storage key next-themes used.
            Server-rendered raw script: executes from the HTML stream and,
            unlike a client-rendered script element, draws no React warning. */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            // Dark is the product default; "system" only follows the OS when
            // the user explicitly picks it in settings.
            __html: `try{var t=localStorage.getItem("theme"),d=t===null||t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){document.documentElement.classList.add("dark")}`,
          }}
        />
      </head>
      {/* Plain block, full bleed. The old `flex justify-start items-start`
          belonged to the marketing landing and shrank every child to its
          content width; the app shell needs the whole viewport. */}
      <body
        className="relative bg-background h-screen overflow-x-hidden"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
