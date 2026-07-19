import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import {
  SCREENS,
  HOME,
  PROFILE,
  CREDITS,
} from "@/components/studio/shell/routes";
import AppShellLayout from "./layout";

// `nav` is mutable so each test can move the layout between routes; vi.hoisted
// keeps it defined before the hoisted vi.mock factory runs. StudioHeader
// needs useRouter, LibraryRail/NowPlayingRail/BottomTabBar need usePathname —
// one mock covers the whole tree this layout mounts.
const nav = vi.hoisted(() => ({ pathname: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => {} }),
}));

function renderShell(pathname: string) {
  nav.pathname = pathname;
  return render(
    <MockStudioProvider>
      <AppShellLayout>
        <div data-testid="page-content">page content</div>
      </AppShellLayout>
    </MockStudioProvider>
  );
}

describe("AppShellLayout", () => {
  beforeEach(() => {
    nav.pathname = HOME;
  });

  it("shows both rails and the page column on a music route", () => {
    renderShell(HOME);

    expect(
      screen.getByRole("complementary", { name: "Your Library" })
    ).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Now playing" })
    ).toBeTruthy();
    expect(screen.getByTestId("page-content")).toBeTruthy();
  });

  it("hides both rails on a profile subpage but still renders the page", () => {
    renderShell(`${PROFILE}/settings`);

    expect(
      screen.queryByRole("complementary", { name: "Your Library" })
    ).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Now playing" })
    ).toBeNull();
    expect(screen.getByTestId("page-content")).toBeTruthy();
  });

  it("hides both rails on credits but still renders the page", () => {
    renderShell(CREDITS);

    expect(
      screen.queryByRole("complementary", { name: "Your Library" })
    ).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Now playing" })
    ).toBeNull();
    expect(screen.getByTestId("page-content")).toBeTruthy();
  });

  it("does not treat a route that merely starts with a system root's letters as a system route", () => {
    // isSystemRoute already proves /terminal must not match /terms in
    // routes.test.ts — this proves the layout actually honours that, not
    // just the predicate in isolation.
    renderShell(`${SCREENS}/terminal`);

    expect(
      screen.getByRole("complementary", { name: "Your Library" })
    ).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Now playing" })
    ).toBeTruthy();
  });
});
