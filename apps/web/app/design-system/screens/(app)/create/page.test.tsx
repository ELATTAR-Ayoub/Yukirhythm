import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { LIBRARY, playlistHref } from "@/components/studio/shell/routes";
import CreatePlaylistScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("CreatePlaylistScreen", () => {
  beforeEach(() => push.mockClear());

  it("renders the create-playlist form body", () => {
    render(
      <MockStudioProvider>
        <CreatePlaylistScreen />
      </MockStudioProvider>
    );

    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("has a way back to the library", () => {
    render(
      <MockStudioProvider>
        <CreatePlaylistScreen />
      </MockStudioProvider>
    );

    const back = screen.getByLabelText("Back") as HTMLAnchorElement;
    expect(back.getAttribute("href")).toBe(LIBRARY);
  });

  it("navigates to the new playlist's page after creating", () => {
    render(
      <MockStudioProvider>
        <CreatePlaylistScreen />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rainy Tapes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(push).toHaveBeenCalledTimes(1);
    const target = push.mock.calls[0][0] as string;
    // The exact local-N id is an implementation detail of MockStudioProvider;
    // what this route must guarantee is that it lands on *a* playlist route.
    expect(target.startsWith(playlistHref(""))).toBe(true);
  });
});
