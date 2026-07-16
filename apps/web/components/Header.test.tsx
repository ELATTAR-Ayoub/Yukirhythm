import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "@/components/Header";
import { emptyUser, makeAuthValue, signedInUser } from "@/test/mocks";

// Header calls useAuth() and branches on user.ID (signed-out vs signed-in),
// so the mocked user must vary per test. vi.hoisted gives us a mutable slot
// that the vi.mock factory (which is itself hoisted above these imports) can
// close over, while still letting each `it` block reassign it before render.
const authState = vi.hoisted(() => ({
  user: null as unknown as ReturnType<typeof makeAuthValue>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState.user,
}));

describe("Header", () => {
  beforeEach(() => {
    authState.user = makeAuthValue(emptyUser);
  });

  it("renders the banner landmark", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("shows the hamburger trigger when signed out", () => {
    authState.user = makeAuthValue(emptyUser);
    const { container } = render(<Header />);
    // Signed-out branch renders the HamburgerMenuIcon svg, not an Avatar.
    expect(container.querySelector("svg")).toBeInTheDocument();
    // Radix Avatar never mounts an <img> in jsdom (it never fires a real
    // load event), so its Fallback text is the reliable signal that the
    // Avatar branch rendered. Its absence here confirms the hamburger
    // branch was taken instead.
    expect(screen.queryByText(signedInUser.userName)).not.toBeInTheDocument();
  });

  it("shows the avatar (with fallback initials) when signed in", () => {
    authState.user = makeAuthValue(signedInUser);
    render(<Header />);
    // Radix's AvatarImage only mounts once the underlying <img> fires a real
    // load event, which jsdom never does — so AvatarFallback is what
    // actually renders here. Its text proves the signed-in branch took
    // effect (Header renders `user.userName.slice(0.2)`, which slices from
    // index 0 to the end, i.e. the full name).
    expect(screen.getByText(signedInUser.userName)).toBeInTheDocument();
  });
});
