import Link from "next/link";
import Texture, { type TextureName } from "@/components/studio/Texture";
import SectionLabel from "@/components/studio/SectionLabel";

const CATEGORIES: {
  href: string;
  title: string;
  desc: string;
  texture: TextureName;
}[] = [
  { href: "core", title: "Core", desc: "Buttons, inputs, cards, rows — the primitives.", texture: "tx-k2-vinyl" },
  { href: "shell", title: "Shell & Navigation", desc: "PageHeader, BottomTabBar, LibraryRail.", texture: "tx-k2-topo" },
  { href: "player", title: "Player", desc: "DevicePlayer, MiniPlayerBar, GlobalPlayer states.", texture: "tx-k2-horizon" },
  { href: "content", title: "Content", desc: "Chips, view toggle, sort, track menu.", texture: "tx-k-marble" },
  { href: "drawers", title: "Drawers", desc: "AppDrawer, playlist detail, create playlist.", texture: "tx-k-silk" },
  { href: "profile", title: "Profile & States", desc: "ProfileBadge, menus, stats, auth, gates.", texture: "tx-k2-static" },
];

export default function ComponentsIndex() {
  return (
    <div>
      <SectionLabel>Living inventory</SectionLabel>
      <h1 className="type-h1 mt-1">Components</h1>
      <p className="type-p text-muted-foreground mt-2 max-w-2xl">
        Every component in its states, split by category so no single page has
        to render the whole system.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
        {CATEGORIES.map((c) => (
          <Link
            key={c.href}
            href={`/design-system/components/${c.href}`}
            className="group rounded-lg border border-border bg-card overflow-hidden hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
          >
            <Texture name={c.texture} className="h-24 w-full" />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="type-h3">{c.title}</span>
                <span className="type-label text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
                  OPEN →
                </span>
              </div>
              <p className="type-muted mt-1.5">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
