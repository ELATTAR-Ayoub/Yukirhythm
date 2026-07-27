import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AuthPageSkeleton,
  CreatePlaylistPageSkeleton,
  CreditsPageSkeleton,
  HomePageSkeleton,
  LibraryPageSkeleton,
  LibraryRailSkeleton,
  NowPlayingRailSkeleton,
  PlaylistAddMusicPageSkeleton,
  PlaylistPageSkeleton,
  PrivacyPageSkeleton,
  ProfilePageSkeleton,
  ProfileViewPageSkeleton,
  QueueAddMusicPageSkeleton,
  QueuePageSkeleton,
  RecentsPageSkeleton,
  RootPageSkeleton,
  SearchPageSkeleton,
  SettingsPageSkeleton,
  StatsPageSkeleton,
  TermsPageSkeleton,
} from "./RouteSkeletons";

const skeletons = [
  ["App entry page", RootPageSkeleton],
  ["Authentication page", AuthPageSkeleton],
  ["Credits page", CreditsPageSkeleton],
  ["Terms page", TermsPageSkeleton],
  ["Home page", HomePageSkeleton],
  ["Search page", SearchPageSkeleton],
  ["Library page", LibraryPageSkeleton],
  ["Create playlist page", CreatePlaylistPageSkeleton],
  ["Queue page", QueuePageSkeleton],
  ["Queue add music page", QueueAddMusicPageSkeleton],
  ["Playlist page", PlaylistPageSkeleton],
  ["Playlist add music page", PlaylistAddMusicPageSkeleton],
  ["Profile page", ProfilePageSkeleton],
  ["Profile view page", ProfileViewPageSkeleton],
  ["Settings page", SettingsPageSkeleton],
  ["Privacy page", PrivacyPageSkeleton],
  ["Listening stats page", StatsPageSkeleton],
  ["Recents page", RecentsPageSkeleton],
  ["Library sidebar", LibraryRailSkeleton],
  ["Now playing sidebar", NowPlayingRailSkeleton],
] as const;

const pageTitles = [
  ["Yukirhythm", RootPageSkeleton],
  ["Listen your way", AuthPageSkeleton],
  ["Credits", CreditsPageSkeleton],
  ["Terms", TermsPageSkeleton],
  ["Home", HomePageSkeleton],
  ["Search", SearchPageSkeleton],
  ["Your Library", LibraryPageSkeleton],
  ["Create playlist", CreatePlaylistPageSkeleton],
  ["Up next", QueuePageSkeleton],
  ["Search songs", QueueAddMusicPageSkeleton],
  ["Playlist", PlaylistPageSkeleton],
  ["Search songs", PlaylistAddMusicPageSkeleton],
  ["Profile", ProfilePageSkeleton],
  ["Your profile", ProfileViewPageSkeleton],
  ["Settings", SettingsPageSkeleton],
  ["Privacy", PrivacyPageSkeleton],
  ["Listening stats", StatsPageSkeleton],
  ["Recents", RecentsPageSkeleton],
] as const;

describe("route skeletons", () => {
  it.each(skeletons)(
    "exposes an accessible, busy loading region for %s",
    (name, Skeleton) => {
      render(<Skeleton />);

      const region = screen.getByRole("status", {
        name: `${name} loading`,
      });
      expect(region).toHaveAttribute("aria-busy", "true");
      expect(region).toHaveTextContent(`Loading ${name}`);
    }
  );

  it.each(pageTitles)(
    "keeps the %s page title readable while loading",
    (title, Skeleton) => {
      render(<Skeleton />);

      expect(
        screen.getByRole("heading", { name: title, hidden: true })
      ).toBeTruthy();
    }
  );

  it("uses different feedback for playlist and queue add routes", () => {
    const { rerender } = render(<QueueAddMusicPageSkeleton />);
    expect(
      screen.getByRole("status", { name: "Queue add music page loading" })
    ).toBeTruthy();

    rerender(<PlaylistAddMusicPageSkeleton />);
    expect(
      screen.getByRole("status", {
        name: "Playlist add music page loading",
      })
    ).toBeTruthy();
  });

  it("keeps the real Home shelf headings visible while cards load", () => {
    render(<HomePageSkeleton />);

    expect(screen.getByText("Recently played")).toBeTruthy();
    expect(screen.getByText("Jump back in")).toBeTruthy();
    expect(screen.getByText("Fresh drops")).toBeTruthy();
    expect(screen.getByText("New releases")).toBeTruthy();
    expect(screen.getByText("For you")).toBeTruthy();
    expect(screen.getByText("You might like")).toBeTruthy();
  });
});
