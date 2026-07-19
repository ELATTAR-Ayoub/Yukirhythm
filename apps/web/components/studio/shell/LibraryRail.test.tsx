import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import LibraryRail from "./LibraryRail";
import { playlistHref } from "./routes";

const nav = vi.hoisted(() => ({ pathname: "/design-system/screens/home" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

/** Empties the seeded user so the signed-out branch can be rendered. */
function SignOutOnMount() {
  const { signOut } = useMockStudio();
  useEffect(() => {
    signOut();
  }, [signOut]);
  return null;
}

/** The seeded Liked Songs collection — confirmed against mock-data.ts. */
const LIKED_ID = "liked";

describe("LibraryRail", () => {
  beforeEach(() => {
    nav.pathname = "/design-system/screens/home";
  });

  it("links each collection to its playlist route", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("href")).toBe(playlistHref(LIKED_ID));
  });

  it("marks no row as current when the page column is elsewhere", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("aria-current")).toBeNull();
  });

  it("marks the open collection as current", () => {
    nav.pathname = playlistHref(LIKED_ID);
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("aria-current")).toBe("page");
  });

  it("does not start playback when a collection is opened", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    // A link navigates; nothing in the rail should invoke the player.
    expect(screen.queryByLabelText(/^Play /)).toBeNull();
  });

  it("offers a create control", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Create playlist")).toBeTruthy();
  });

  it("prompts sign-in when signed out", () => {
    render(
      <MockStudioProvider>
        <SignOutOnMount />
        <LibraryRail />
      </MockStudioProvider>
    );

    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /liked songs/i })).toBeNull();
  });
});
