import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import PlaylistScreen from "./page";

const nav = vi.hoisted(() => ({
  id: "liked",
  created: null as string | null,
  replace: vi.fn(),
}));
const testBackend = vi.hoisted(() => ({
  catalog: {
    tracksByIds: vi.fn(),
    track: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: nav.id }),
  useSearchParams: () =>
    new URLSearchParams(nav.created ? { created: nav.created } : undefined),
  usePathname: () => `/design-system/screens/playlist/${nav.id}`,
  // CollectionDetail's Add-music control calls useRouter() unconditionally
  // now (it routes at every width); none of these tests exercise that click.
  useRouter: () => ({ push: () => {}, replace: nav.replace }),
}));
vi.mock("@/lib/studio/useBackend", () => ({
  useBackend: () => testBackend,
}));

describe("PlaylistScreen", () => {
  beforeEach(() => {
    nav.id = "liked";
    nav.created = null;
    nav.replace.mockClear();
  });

  it("renders the collection title and description", () => {
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );

    // TrackRow's desktop album column (Task 13) now also prints the
    // collection's title once per row, so the hero heading is no longer the
    // only "Liked Songs" text on the page — scope to the heading itself.
    expect(
      screen.getByRole("heading", { name: "Liked Songs", level: 1 })
    ).toBeTruthy();
    expect(screen.getByText(/Every track you've hearted/)).toBeTruthy();
  });

  it("renders a play control for the collection", () => {
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Play collection")).toBeTruthy();
    expect(screen.queryByLabelText("Clear queue")).toBeNull();
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

  it("keeps a just-created pending route rendered and replaces it with the server id", () => {
    nav.id = "pending-create-id";
    nav.created = "Liked Songs";
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );

    expect(
      screen.getByRole("heading", { name: "Liked Songs", level: 1 })
    ).toBeTruthy();
    expect(nav.replace).toHaveBeenCalledWith("/playlist/liked");
    expect(screen.queryByText(/Collection not found/i)).toBeNull();
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
