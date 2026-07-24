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

// The layout now mounts the real StudioProvider, which initialises Firebase.
// This suite is about the shell grid, so stand the provider down and let the
// test supply state through MockStudioProvider as before.
vi.mock("@/components/studio/StudioProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The shell suite is about the grid; sign the gate in so it stays out of the
// way (AuthGate has its own suite).
vi.mock("@/lib/studio/useAuth", () => ({
  useAuthState: () => ({ user: { uid: "u1" }, loading: false }),
}));

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

  it("lets the page column fill the row on a system route instead of capping at 880px", () => {
    // Both rails are absent on a system route (asserted above), so `main` is
    // the row's only flex child — it should size itself with `flex-1` alone.
    // The old `md:mx-auto md:max-w-[880px] md:w-full` left ~500px of dead
    // band on each side at wide viewports; jsdom has no layout engine, so the
    // class list itself is the only observable proof the cap is gone.
    renderShell(`${PROFILE}/settings`);

    const main = screen.getByTestId("page-content").closest("main")!;
    expect(main.className).not.toContain("max-w-[880px]");
    expect(main.className).not.toContain("mx-auto");
    expect(main.className).toContain("flex-1");
  });

  it("still gives the page column the same flex-1 sizing on a music route", () => {
    // Regression guard: the fix must not special-case music routes — they
    // never had the cap, and must keep behaving exactly as before.
    renderShell(HOME);

    const main = screen.getByTestId("page-content").closest("main")!;
    expect(main.className).not.toContain("max-w-[880px]");
    expect(main.className).toContain("flex-1");
  });
});
