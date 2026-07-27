import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

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

/** Surfaces the context's hasSearched flag so tests can assert a search fired
 *  (or didn't) without depending on the shape of the results themselves. */
function SearchProbe() {
  const { hasSearched } = useMockStudio();
  return <div data-testid="has-searched">{String(hasSearched)}</div>;
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
});

describe("StudioHeader search field", () => {
  beforeEach(() => {
    push.mockClear();
    nav.pathname = SEARCH;
  });

  it("does not search while typing", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    fireEvent.change(searchField(), { target: { value: "lofi" } });
    expect(screen.getByTestId("has-searched").textContent).toBe("false");
  });

  it("searches on submit", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    fireEvent.change(searchField(), { target: { value: "lofi" } });
    fireEvent.submit(screen.getByRole("search", { name: "Site search" }));
    expect(screen.getByTestId("has-searched").textContent).toBe("true");
  });

  it("dismisses the phone keyboard when the search form is submitted", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );
    const input = searchField();
    input.focus();
    fireEvent.change(input, { target: { value: "lofi" } });

    fireEvent.submit(screen.getByRole("search", { name: "Site search" }));

    expect(document.activeElement).not.toBe(input);
  });

  it("still routes to the search page on focus from elsewhere", () => {
    nav.pathname = HOME;
    render(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    fireEvent.focus(searchField());
    expect(push).toHaveBeenCalledWith(SEARCH);
  });

  it("abandons the search when navigating off the search page", () => {
    const { rerender } = render(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    fireEvent.change(searchField(), { target: { value: "cobalt" } });
    fireEvent.submit(screen.getByRole("search", { name: "Site search" }));
    expect(screen.getByTestId("has-searched").textContent).toBe("true");

    nav.pathname = HOME;
    rerender(
      <MockStudioProvider>
        <StudioHeader />
        <SearchProbe />
      </MockStudioProvider>
    );

    expect(searchField().value).toBe("");
    expect(screen.getByTestId("has-searched").textContent).toBe("false");
  });
});
