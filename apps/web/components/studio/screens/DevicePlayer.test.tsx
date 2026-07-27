import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_COLLECTIONS, getCollectionTracks } from "./mock-data";
import { HOME, QUEUE, QUEUE_ADD, playlistHref } from "../shell/routes";
import DevicePlayer from "./DevicePlayer";

const { push, nav } = vi.hoisted(() => ({
  push: vi.fn(),
  nav: { pathname: "/home" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => nav.pathname,
}));

function PlayPlaylist() {
  const { play } = useMockStudio();
  const source = MOCK_COLLECTIONS[0];
  return (
    <button onClick={() => play(getCollectionTracks(source)[0], source)}>
      seed playlist
    </button>
  );
}

describe("DevicePlayer", () => {
  afterEach(() => {
    push.mockClear();
    nav.pathname = HOME;
  });

  it("shows a collapse control when given onCollapse", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer onCollapse={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Collapse player")).toBeTruthy();
  });

  it("has no collapse control when docked", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Collapse player")).toBeNull();
  });

  it("has no collapse control when docked even if onCollapse is passed", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer docked onCollapse={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Collapse player")).toBeNull();
  });

  it("hides the search tray when docked", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Search tracks")).toBeNull();
  });

  it("shows its mobile-only search tray only on the ad-hoc queue route", () => {
    nav.pathname = QUEUE;
    render(
      <MockStudioProvider>
        <DevicePlayer onCollapse={() => {}} />
      </MockStudioProvider>
    );
    const search = screen.getByLabelText("Search tracks");
    const tray = search.closest(".anim-tray-out") as HTMLElement;
    expect(tray.className).toContain("md:hidden");
  });

  it("collapses the player and routes queue search to its dedicated page, never a drawer", () => {
    nav.pathname = QUEUE;
    const collapse = vi.fn();
    render(
      <MockStudioProvider>
        <DevicePlayer onCollapse={collapse} />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByLabelText("Search tracks"));

    expect(collapse).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(QUEUE_ADD);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show queue search on a playlist page", () => {
    nav.pathname = playlistHref(MOCK_COLLECTIONS[0].id);
    render(
      <MockStudioProvider>
        <DevicePlayer onCollapse={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Search tracks")).toBeNull();
  });

  it("fills its container when docked instead of capping at 340px", () => {
    const { container } = render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    const root = container.firstElementChild as HTMLElement;
    // jsdom has no layout engine and no Tailwind stylesheet, so a width
    // assertion would read 0 either way — the class is the only observable
    // signal that the 340px cap was lifted.
    expect(root.className).not.toContain("max-w-[340px]");
  });

  it("shows a Like control instead of Loop in its transport", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Loop")).toBeNull();
    expect(screen.getByLabelText(/^Like/)).toBeTruthy();
  });

  describe("transport queue control", () => {
    it("navigates to /queue for ad-hoc playback", () => {
      render(
        <MockStudioProvider>
          <DevicePlayer onCollapse={() => {}} />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByLabelText("Queue"));

      expect(push).toHaveBeenCalledWith(QUEUE);
    });

    it("navigates to the source playlist for playlist playback", () => {
      const source = MOCK_COLLECTIONS[0];
      render(
        <MockStudioProvider>
          <PlayPlaylist />
          <DevicePlayer onCollapse={() => {}} />
        </MockStudioProvider>
      );
      fireEvent.click(screen.getByText("seed playlist"));
      fireEvent.click(screen.getByLabelText("Queue"));

      expect(push).toHaveBeenCalledWith(playlistHref(source.id));
      expect(push).not.toHaveBeenCalledWith(QUEUE);
    });
  });
});
