import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import PlaylistScreen from "./page";

const nav = vi.hoisted(() => ({ id: "liked" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: nav.id }),
  usePathname: () => `/design-system/screens/playlist/${nav.id}`,
}));

describe("PlaylistScreen", () => {
  beforeEach(() => {
    nav.id = "liked";
  });

  it("renders the collection title and description", () => {
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );

    expect(screen.getByText("Liked Songs")).toBeTruthy();
    expect(screen.getByText(/Every track you've hearted/)).toBeTruthy();
  });

  it("renders a play control for the collection", () => {
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Play collection")).toBeTruthy();
  });

  it("falls back to an empty state for an unknown id", () => {
    nav.id = "does-not-exist";
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );
    expect(screen.getByText(/Collection not found/i)).toBeTruthy();
  });

  // No test for decoding a url-encoded id: every collection id reachable from
  // MockStudioProvider is plain alphanumeric/hyphen (mock-data's "c1".."c7",
  // "liked", and createCollection's `local-${n}`), so no id in the running
  // app ever needs percent-decoding. routes.test.ts already proves
  // playlistHref's encodeURIComponent side against a hypothetical "local 1"
  // id; there is no matching collection to decode back to here, so a test
  // built on a fabricated id would just assert decodeURIComponent(x) === x
  // — true whether or not decodeURIComponent is ever called. That's the
  // vacuous-assertion trap the task warned about, so this case is left out.
});
