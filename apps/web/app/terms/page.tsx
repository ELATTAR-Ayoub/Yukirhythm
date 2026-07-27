import type { Metadata } from "next";

import BackHeader from "@/components/studio/screens/BackHeader";
import SectionLabel from "@/components/studio/SectionLabel";
import ScreensFrame from "@/components/studio/screens/ScreensFrame";
import { SCREENS } from "@/components/studio/shell/routes";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

export const metadata: Metadata = {
  title: "Terms · Yukirhythm",
  description: "The mock terms of service for the Yukirhythm screens preview.",
};

const SECTIONS = [
  {
    label: "01",
    title: "This is a preview",
    body: "Yukirhythm's screens area is a design-system prototype. Nothing you do here reaches a server, no account is created, and no data leaves your browser. State resets when you reload the page.",
  },
  {
    label: "02",
    title: "The music is fake",
    body: "Every track, artist, playlist and cover you see is generated placeholder content. Artwork is drawn from the studio texture pack, not from any real release. Playback is simulated, so no audio is streamed or downloaded.",
  },
  {
    label: "03",
    title: "Sign-in is simulated",
    body: "The Google and Facebook buttons flip a local flag and nothing more. No OAuth flow runs, no credentials are collected, and no provider is contacted. The email shown on the settings screen is fixture data.",
  },
  {
    label: "04",
    title: "What we store",
    body: "One thing: your appearance preference, kept in this browser's local storage so the theme survives a reload. Clearing site data removes it. There are no cookies, analytics or third-party scripts on these screens.",
  },
  {
    label: "05",
    title: "No warranty, no service",
    body: "This prototype is provided as-is to demonstrate interface and motion decisions. It is not a product, carries no availability guarantee, and may change or disappear without notice.",
  },
];

export default function TermsScreen() {
  return (
    <ScreensFrame>
      <div className="max-w-xl space-y-8 pb-16">
        <BackHeader title="Terms" fallbackHref={`${BASE}/auth`} />

        <p className="type-small text-muted-foreground">
          The short version: this is a prototype, the music is not real, and
          nothing here touches the network.
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
