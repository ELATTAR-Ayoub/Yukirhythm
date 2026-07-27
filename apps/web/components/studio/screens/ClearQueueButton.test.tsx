import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import ClearQueueButton from "./ClearQueueButton";

const { clearQueue, toast } = vi.hoisted(() => ({
  clearQueue: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./MockStudioProvider", () => ({
  useMockStudio: () => ({
    queue: [{ id: "queued" }],
    clearQueue,
  }),
}));
vi.mock("sonner", () => ({ toast }));

describe("ClearQueueButton", () => {
  beforeEach(() => {
    clearQueue.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it("keeps the alert open and shows progress until clearing finishes", async () => {
    let finish!: () => void;
    clearQueue.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    render(<ClearQueueButton />);

    fireEvent.click(screen.getByLabelText("Clear queue"));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Clear queue" })
    );

    expect(clearQueue).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: "Clearing queue" })).toBeTruthy();
    expect(screen.getByText("Clearing…")).toBeTruthy();
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    finish();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith("Queue cleared");
  });

  it("leaves the alert open and reports a failed clear", async () => {
    clearQueue.mockRejectedValueOnce(new Error("offline"));
    render(<ClearQueueButton />);

    fireEvent.click(screen.getByLabelText("Clear queue"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Clear queue",
      })
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not clear the queue")
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
