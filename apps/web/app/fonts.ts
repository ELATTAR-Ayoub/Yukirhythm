import localFont from "next/font/local";
import { Noto_Sans_JP } from "next/font/google";

// Studio type system (owner-decided):
//   Satoshi — display + interface
//   OffBit  — pixel labels + wordmark accents
//   OffBit Dot — digital data (timestamps, BPM, stats)
// Roles are consumed through CSS variables so faces can be swapped in one place.

export const fontSans = localFont({
  src: [
    { path: "../public/fonts/satoshi/Satoshi-Light.otf", weight: "300", style: "normal" },
    { path: "../public/fonts/satoshi/Satoshi-LightItalic.otf", weight: "300", style: "italic" },
    { path: "../public/fonts/satoshi/Satoshi-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/satoshi/Satoshi-Italic.otf", weight: "400", style: "italic" },
    { path: "../public/fonts/satoshi/Satoshi-Medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/satoshi/Satoshi-MediumItalic.otf", weight: "500", style: "italic" },
    { path: "../public/fonts/satoshi/Satoshi-Bold.otf", weight: "700", style: "normal" },
    { path: "../public/fonts/satoshi/Satoshi-BoldItalic.otf", weight: "700", style: "italic" },
    { path: "../public/fonts/satoshi/Satoshi-Black.otf", weight: "900", style: "normal" },
    { path: "../public/fonts/satoshi/Satoshi-BlackItalic.otf", weight: "900", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const fontPixel = localFont({
  src: [
    { path: "../public/fonts/offbit/OffBit-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/offbit/OffBit-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-pixel",
  display: "swap",
});

export const fontPixelDot = localFont({
  src: [
    { path: "../public/fonts/offbit/OffBit-Dot.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/offbit/OffBit-DotBold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-pixel-dot",
  display: "swap",
});

// Library titles are frequently JP/CN — always present as fallback.
export const fontJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-jp",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  fontSans.variable,
  fontPixel.variable,
  fontPixelDot.variable,
  fontJP.variable,
].join(" ");
