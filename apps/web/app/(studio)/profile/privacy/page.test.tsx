import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MockStudioProvider, {
  MockStudioContext,
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import PrivacyScreen from "./page";
const calls = vi.hoisted(() => ({
  update: vi.fn(),
  clear: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: calls.error }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn() }) }));
function Harness({ loading = false }: { loading?: boolean }) {
  const value = useMockStudio();
  return (
    <MockStudioContext.Provider
      value={{
        ...value,
        privacyLoading: loading,
        updatePrivacy: calls.update,
        clearListeningHistory: calls.clear,
      }}
    >
      <PrivacyScreen />
    </MockStudioContext.Provider>
  );
}
const mount = (loading = false) =>
  render(
    <MockStudioProvider>
      <Harness loading={loading} />
    </MockStudioProvider>
  );
beforeEach(() => {
  calls.update.mockReset().mockResolvedValue(undefined);
  calls.clear.mockReset().mockResolvedValue(undefined);
  calls.error.mockClear();
});
it("persists a changed privacy choice through the provider", async () => {
  mount();
  fireEvent.click(
    screen.getByRole("switch", { name: "Save listening history" })
  );
  await waitFor(() =>
    expect(calls.update).toHaveBeenCalledWith({ saveHistory: false })
  );
});
it("disables controls until saved preferences are loaded", () => {
  mount(true);
  for (const control of screen.getAllByRole("switch"))
    expect(control).toBeDisabled();
});
it("keeps a failed preference unchanged and reports the failure", async () => {
  calls.update.mockRejectedValueOnce(new Error("offline"));
  mount();
  fireEvent.click(
    screen.getByRole("switch", { name: "Save listening history" })
  );
  await waitFor(() => expect(calls.error).toHaveBeenCalled());
  expect(
    screen.getByRole("switch", { name: "Save listening history" })
  ).toHaveAttribute("aria-checked", "true");
});
it("requires confirmation and performs the actual history clear", async () => {
  mount();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear listening history" })
  );
  expect(calls.clear).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
  await waitFor(() => expect(calls.clear).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});
