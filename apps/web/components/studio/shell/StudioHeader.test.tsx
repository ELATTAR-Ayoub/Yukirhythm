import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import StudioHeader from "./StudioHeader";
import { HOME, SEARCH } from "./routes";

// `nav` is mutable so a test can move the header between routes; vi.hoisted
// keeps it defined before the hoisted vi.mock factory runs.
const { push, nav } = vi.hoisted(() => ({
  push: vi.fn(),
  nav: { pathname: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => nav.pathname,
}));

/** Surfaces the context's search state so tests can assert on it. */
function SearchProbe() {
  const { searchResults } = useMockStudio();
  return (
    <div data-testid="results">
      {searchResults.map((t) => t.title).join(",")}
    </div>
  );
}

/** Empties the seeded user so the signed-out branch can be rendered. */
function SignOutOnMount() {
  const { signOut } = useMockStudio();
  useEffect(() => {
    signOut();
  }, [signOut]);
  return null;
}

const searchField = () => screen.getByLabelText("Search") as HTMLInputElement;

describe("StudioHeader", () => {
  beforeEach(() => {
    push.mockClear();
    nav.pathname = HOME;
    // Radix checks pointer capture APIs jsdom does not implement.
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes to the search page when the field is focused", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );

    fireEvent.focus(searchField());
    expect(push).toHaveBeenCalledWith(SEARCH);
  });

  it("does not re-route when the field is refocused on the search page", () => {
    nav.pathname = SEARCH;
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );

    fireEvent.focus(searchField());
    expect(push).not.toHaveBeenCalled();
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

  it("offers sign in and no account menu when signed out", () => {
    render(
      <MockStudioProvider>
        <SignOutOnMount />
        <StudioHeader />
      </MockStudioProvider>
    );

    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.queryByLabelText("Account menu")).toBeNull();
  });

  it("drives the studio search as the field changes, and clears on empty", () => {
    vi.useFakeTimers();
    nav.pathname = SEARCH;
    render(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    fireEvent.change(searchField(), { target: { value: "cobalt" } });
    // The mock provider debounces its search by 550ms.
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.getByTestId("results").textContent).toContain("Cobalt Dreams");

    fireEvent.change(searchField(), { target: { value: "" } });
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.getByTestId("results").textContent).toBe("");
  });

  it("abandons the search when navigating off the search page", () => {
    vi.useFakeTimers();
    nav.pathname = SEARCH;
    const { rerender } = render(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    fireEvent.change(searchField(), { target: { value: "cobalt" } });
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.getByTestId("results").textContent).toContain("Cobalt Dreams");

    nav.pathname = HOME;
    rerender(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    expect(searchField().value).toBe("");
    expect(screen.getByTestId("results").textContent).toBe("");
  });
});
