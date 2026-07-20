import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "./MockStudioProvider";
import CreatePlaylistForm from "./CreatePlaylistForm";

describe("CreatePlaylistForm", () => {
  it("creates a collection and hands it to onCreated", () => {
    const onCreated = vi.fn();
    render(
      <MockStudioProvider>
        <CreatePlaylistForm onCreated={onCreated} />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rainy Tapes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0].title).toBe("Rainy Tapes");
  });

  it("does not submit when the name is only whitespace", () => {
    // A whitespace-only value satisfies the input's HTML5 `required` check
    // (it has non-zero length), so this exercises the component's own
    // `title.trim()` guard rather than native form validation.
    const onCreated = vi.fn();
    render(
      <MockStudioProvider>
        <CreatePlaylistForm onCreated={onCreated} />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreated).not.toHaveBeenCalled();
  });

  it("resets its fields after a successful create", () => {
    render(
      <MockStudioProvider>
        <CreatePlaylistForm onCreated={() => {}} />
      </MockStudioProvider>
    );

    const nameField = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(nameField, { target: { value: "Rainy Tapes" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(nameField.value).toBe("");
  });
});
