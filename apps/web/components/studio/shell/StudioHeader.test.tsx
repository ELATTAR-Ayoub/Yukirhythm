import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import StudioHeader from "./StudioHeader";
import { SEARCH } from "./routes";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/design-system/screens/home",
}));

describe("StudioHeader", () => {
  beforeEach(() => {
    push.mockClear();
    // Radix checks pointer capture APIs jsdom does not implement.
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  it("routes to the search page when the field is focused", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );

    fireEvent.focus(screen.getByLabelText("Search"));
    expect(push).toHaveBeenCalledWith(SEARCH);
  });

  it("links home", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Home")).toBeTruthy();
  });

  it("opens a profile menu from the avatar", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );

    // Radix's DropdownMenuTrigger opens on pointerdown, not click (there is
    // no onClick handler in the package) — fireEvent.click never fires a
    // pointerdown in jsdom, and @testing-library/user-event (which does)
    // isn't a dependency here, so we dispatch the event Radix actually
    // listens for.
    fireEvent.pointerDown(screen.getByLabelText("Account menu"), {
      button: 0,
    });
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Credits")).toBeTruthy();
  });
});
