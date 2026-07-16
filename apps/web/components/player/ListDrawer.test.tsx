import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListDrawer } from "@/components/player/ListDrawer";
import { usePlayerStore } from "@/store/player";
import { makeAuthValue } from "@/test/mocks";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => makeAuthValue(),
}));

// ListDrawer renders <Toaster /> from components/ui/sonner.tsx, which
// imports { Toaster } from "sonner" — stub it too or the mock is incomplete.
vi.mock("sonner", () => ({ toast: vi.fn(), Toaster: () => null }));

describe("player ListDrawer", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      audioState: [],
      currentAudio: 0,
      audioPlaying: false,
    });
  });

  it("mounts and renders its trigger button", () => {
    render(<ListDrawer />);
    // Drawer content is not mounted until opened, so the only button in the
    // tree is the icon-only trigger — confirms the component renders at all.
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("does not render the drawer content until opened", () => {
    render(<ListDrawer />);
    expect(screen.queryByText("Audio Drawer")).not.toBeInTheDocument();
  });
});
