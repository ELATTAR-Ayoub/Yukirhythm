import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShareDialog from "./ShareDialog";
it("does not offer a private link for sharing until the visibility change succeeds", async () => {
  const makeShareable = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);
  render(
    <ShareDialog
      open
      onOpenChange={() => {}}
      title="Private mix"
      url="http://localhost/playlist/id"
      text="Listen"
      blockedReason="This playlist is private."
      onMakeShareable={makeShareable}
    />
  );
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Allow anyone with the link" })
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Allow anyone with the link" })
    ).toBeEnabled()
  );
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Allow anyone with the link" })
  );
  expect(
    await screen.findByRole("button", { name: "Copy link" })
  ).toBeInTheDocument();
});
it("does not offer external share targets for personal Liked Songs", () => {
  render(
    <ShareDialog
      open
      onOpenChange={() => {}}
      title="Liked Songs"
      url="http://localhost/playlist/liked"
      text="Listen"
      blockedReason="Liked Songs is personal."
    />
  );
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
  expect(screen.queryByText("X")).toBeNull();
});
