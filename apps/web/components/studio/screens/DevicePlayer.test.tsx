import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "./MockStudioProvider";
import DevicePlayer from "./DevicePlayer";

describe("DevicePlayer", () => {
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
    expect(root.className).not.toContain("max-w-[340px]");
  });
});
