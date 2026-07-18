import Link from "next/link";
import Texture, { type TextureName } from "@/components/studio/Texture";
import SectionLabel from "@/components/studio/SectionLabel";

const SCREENS: {
  href: string;
  title: string;
  mirrors: string;
  texture: TextureName;
}[] = [
  {
    href: "home",
    title: "Home",
    mirrors: "The player — device card, disc, transport, search + results.",
    texture: "tx-k2-vinyl",
  },
  {
    href: "profile",
    title: "Profile",
    mirrors: "Tabs: favorite audio and collections, signed-in vs signed-out.",
    texture: "tx-k-marble",
  },
  {
    href: "login",
    title: "Login",
    mirrors: "Aurora sign-in — social buttons + email form.",
    texture: "tx-k2-horizon",
  },
  {
    href: "signup",
    title: "Sign up",
    mirrors: "Aurora account creation.",
    texture: "tx-k-silk",
  },
  {
    href: "credits",
    title: "Credits",
    mirrors: "Aurora author card + social badges.",
    texture: "tx-k2-topo",
  },
];

export default function ScreensIndex() {
  return (
    <div>
      <SectionLabel>Living previews</SectionLabel>
      <h1 className="type-h1 mt-1">Screens</h1>
      <p className="type-p text-muted-foreground mt-2 max-w-2xl">
        The app&apos;s pages rebuilt on the studio system, driven by mock data.
        Play, search, switch tabs, sign in and out — every flow runs locally,
        nothing hits the network.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
        {SCREENS.map((s) => (
          <Link
            key={s.href}
            href={`/design-system/screens/${s.href}`}
            className="group rounded-lg border border-border bg-card overflow-hidden hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
          >
            <Texture name={s.texture} className="h-28 w-full" />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="type-h3">{s.title}</span>
                <span className="type-label text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
                  OPEN →
                </span>
              </div>
              <p className="type-muted mt-1.5">{s.mirrors}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
