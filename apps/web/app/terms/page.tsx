import type { Metadata } from "next";

import BackHeader from "@/components/studio/screens/BackHeader";
import SectionLabel from "@/components/studio/SectionLabel";
import ScreensFrame from "@/components/studio/screens/ScreensFrame";
import { SCREENS } from "@/components/studio/shell/routes";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

export const metadata: Metadata = {
  title: "Terms · Yukirhythm",
  description: "How Yukirhythm handles sign-in, playback, and saved data.",
};

const SECTIONS = [
  {
    label: "01",
    title: "Using Yukirhythm",
    body: "Yukirhythm searches music and plays available tracks through YouTube. Track availability depends on YouTube, and some videos may be unavailable in your region or unable to play in an embedded player.",
  },
  {
    label: "02",
    title: "Playback",
    body: "Playback uses YouTube's embedded player and contacts YouTube. Audio files are not stored by Yukirhythm. Search results, artwork, and track information come from external providers.",
  },
  {
    label: "03",
    title: "Your account",
    body: "Google and Facebook sign-in use Firebase Authentication. Yukirhythm stores your account identifier and basic profile information so your library can be associated with your account.",
  },
  {
    label: "04",
    title: "What we store",
    body: "Your profile preferences, likes, and playlists are saved to the server. When Save listening history is enabled, meaningful listens are also saved and can be used for recommendations when personalization is enabled. Privacy settings let you change these preferences and clear listening history.",
  },
  {
    label: "05",
    title: "Data in this browser",
    body: "Playback position, queue, volume, appearance, cached recommendations, and a recent listening archive are stored in this browser. Clearing site data removes these local copies. Playback state and local listening statistics do not currently sync between devices.",
  },
];

export default function TermsScreen() {
  return (
    <ScreensFrame>
      <div className="max-w-xl space-y-8 pb-16">
        <BackHeader title="Terms" fallbackHref={`${BASE}/auth`} />

        <p className="type-small text-muted-foreground">
          How sign-in, playback, and saved data work in Yukirhythm.
        </p>

        <div className="space-y-7">
          {SECTIONS.map(({ label, title, body }) => (
            <section key={label}>
              <SectionLabel>{label}</SectionLabel>
              <h2 className="type-h4 mt-1">{title}</h2>
              <p className="type-muted mt-2 leading-relaxed">{body}</p>
            </section>
          ))}
        </div>

        <p className="type-label text-muted-foreground">
          Mock document · no legal effect
        </p>
      </div>
    </ScreensFrame>
  );
}
