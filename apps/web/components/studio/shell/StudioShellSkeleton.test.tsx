import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { navigation } = vi.hoisted(() => ({
  navigation: { pathname: "/home" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

import StudioShellSkeleton, {
  SkeletonForStudioPath,
} from "./StudioShellSkeleton";

describe("StudioShellSkeleton", () => {
  it.each([
    ["/home", "Home page"],
    ["/search", "Search page"],
    ["/library", "Library page"],
    ["/create", "Create playlist page"],
    ["/queue", "Queue page"],
    ["/queue/add", "Queue add music page"],
    ["/playlist/mix-1", "Playlist page"],
    ["/playlist/mix-1/add", "Playlist add music page"],
    ["/profile", "Profile page"],
    ["/profile/view", "Profile view page"],
    ["/profile/settings", "Settings page"],
    ["/profile/privacy", "Privacy page"],
    ["/profile/stats", "Listening stats page"],
    ["/profile/recents", "Recents page"],
  ])("maps %s to its own skeleton", (pathname, name) => {
    render(<SkeletonForStudioPath pathname={pathname} />);

    expect(
      screen.getByRole("status", { name: `${name} loading` })
    ).toBeTruthy();
  });

  it("includes responsive desktop rails and both player placeholders", () => {
    navigation.pathname = "/search";
    render(<StudioShellSkeleton />);

    const library = screen.getByRole("status", {
      name: "Library sidebar loading",
    });
    const nowPlaying = screen.getByRole("status", {
      name: "Now playing sidebar loading",
    });
    expect(library.closest("aside")).toHaveClass("md:block");
    expect(nowPlaying.closest("aside")).toHaveClass("3xl:block");
    expect(
      screen.getByRole("status", { name: "Mobile player loading" })
    ).toHaveClass("md:hidden");
    expect(
      screen.getByRole("status", { name: "Desktop player loading" })
    ).toHaveClass("md:block");
    expect(
      screen.getByRole("status", { name: "Search page loading" })
    ).toBeTruthy();
  });
});
