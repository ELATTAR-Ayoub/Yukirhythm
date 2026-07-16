import {
  Inter,
  Space_Grotesk,
  IBM_Plex_Mono,
  VT323,
  Noto_Sans_JP,
} from "next/font/google";

// Studio type system — display / ui / label / data (+ CJK fallback).
// Roles are consumed through CSS variables so the faces can be swapped
// in one place without touching components.

export const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const fontUI = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const fontLabel = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-label",
  display: "swap",
});

// Dot/LCD face for numeric data (timestamps, BPM, stats).
export const fontData = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-data",
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
  fontDisplay.variable,
  fontUI.variable,
  fontLabel.variable,
  fontData.variable,
  fontJP.variable,
].join(" ");
