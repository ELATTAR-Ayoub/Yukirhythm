import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TagChip } from "./TagChip";

describe("TagChip", () => {
  it("renders as a plain span (no button semantics) when there is no onClick and no onRemove", () => {
    render(<TagChip label="lofi" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("lofi")).toBeTruthy();
  });

  it("names its remove control after the tag it removes, and calls back with no args", () => {
    const onRemove = vi.fn();
    render(<TagChip label="lofi" onRemove={onRemove} />);

    const remove = screen.getByRole("button", { name: "Remove lofi" });
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove.mock.calls[0]).toEqual([]);
  });

  it("blocks onClick and marks aria-disabled when disabled", () => {
    const onClick = vi.fn();
    render(<TagChip label="Mosaic" onClick={onClick} disabled />);

    const btn = screen.getByRole("button", { name: "Mosaic" });
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays enabled and clickable when disabled is not passed (existing call sites)", () => {
    const onClick = vi.fn();
    render(<TagChip label="Music" onClick={onClick} />);

    const btn = screen.getByRole("button", { name: "Music" });
    expect(btn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
