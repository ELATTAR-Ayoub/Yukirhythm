import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "./MockStudioProvider";
import { QUEUE } from "../shell/routes";
import DevicePlayer from "./DevicePlayer";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("DevicePlayer", () => {
  afterEach(() => {
    push.mockClear();
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

  it("keeps the search tray in the overlay presentation", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer onCollapse={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Search tracks")).toBeTruthy();
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

  describe("transport queue control", () => {
    it("navigates to the routed queue page, at every width", () => {
      render(
        <MockStudioProvider>
          <DevicePlayer onCollapse={() => {}} />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByLabelText("Queue"));

      expect(push).toHaveBeenCalledWith(QUEUE);
    });
  });
});
