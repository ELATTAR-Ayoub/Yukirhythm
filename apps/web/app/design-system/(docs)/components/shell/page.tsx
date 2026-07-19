"use client";

import { useState } from "react";
import {
  BellIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  StackIcon,
} from "@radix-ui/react-icons";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import PageHeader from "@/components/studio/screens/PageHeader";
import BottomTabBar from "@/components/studio/screens/BottomTabBar";
import LibraryRail from "@/components/studio/shell/LibraryRail";
import NavTabs, { type NavTabItem } from "@/components/studio/screens/NavTabs";
import { PlayerButton } from "@/components/studio/PlayerButton";

const NAV_TABS_DEMO_ITEMS: NavTabItem[] = [
  { href: "#home", label: "Home", icon: HomeIcon },
  { href: "#search", label: "Search", icon: MagnifyingGlassIcon },
  { href: "#library", label: "Library", icon: StackIcon },
];

/**
 * Standalone NavTabs demo — the real component navigates via next/link, which
 * would leave the gallery page. Here a capture-phase click handler intercepts
 * the anchor before Link's own navigation runs, and flips local state instead
 * so the jelly-slide indicator is still fully interactive.
 */
function NavTabsDemo() {
  const [active, setActive] = useState(NAV_TABS_DEMO_ITEMS[0].href);

  return (
    <div
      className="max-w-sm"
      onClickCapture={(e) => {
        const anchor = (e.target as HTMLElement).closest("a[href]");
        const href = anchor?.getAttribute("href");
        if (href) {
          e.preventDefault();
          setActive(href);
        }
      }}
    >
      <NavTabs
        items={NAV_TABS_DEMO_ITEMS}
        activeHref={active}
        className="bg-muted"
      />
    </div>
  );
}

export default function ShellComponentsPage() {
  return (
    <MockStudioProvider>
      <div>
        <h1 className="type-h1 mb-8">Shell &amp; Navigation</h1>

        <DsSection index="01" title="PageHeader">
          <StatePanel
            name="PageHeader"
            signal="header_avatar → profile"
            views={{
              default: <PageHeader title="Home" />,
              "with actions": (
                <PageHeader
                  title="Home"
                  actions={
                    <PlayerButton variant="ghost" aria-label="Notifications">
                      <BellIcon />
                    </PlayerButton>
                  }
                />
              ),
            }}
          />
        </DsSection>

        <DsSection index="02" title="BottomTabBar">
          <StatePanel
            name="BottomTabBar (mobile)"
            signal="tab_switch"
            views={{
              default: (
                <div className="relative h-20 overflow-hidden rounded-lg border border-border [&>nav]:absolute [&>nav]:md:flex">
                  <BottomTabBar />
                </div>
              ),
            }}
          />
        </DsSection>

        <DsSection index="03" title="LibraryRail">
          <StatePanel
            name="LibraryRail (desktop)"
            signal="nav_switch"
            views={{
              default: (
                <div className="h-96 rounded-lg border border-border overflow-hidden">
                  <LibraryRail />
                </div>
              ),
            }}
          />
        </DsSection>

        <DsSection index="04" title="NavTabs">
          <StatePanel
            name="NavTabs — jelly sliding pill"
            signal="tab_switch"
            views={{
              default: <NavTabsDemo />,
            }}
          />
        </DsSection>
      </div>
    </MockStudioProvider>
  );
}
