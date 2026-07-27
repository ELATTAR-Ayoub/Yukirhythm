import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

describe("Dialog", () => {
  it("keeps long content within the mobile viewport and allows text to wrap", () => {
    const title = "VeryLongDialogTitle".repeat(20);
    const description = "VeryLongDialogDescription".repeat(20);

    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[calc(100dvh-2rem)]",
      "w-[calc(100vw-2rem)]",
      "min-w-0",
      "overflow-y-auto",
      "[overflow-wrap:anywhere]",
      "[&_*]:max-w-full",
      "[&_*]:min-w-0"
    );
    expect(screen.getByText(title)).toHaveClass(
      "max-w-full",
      "break-words",
      "[overflow-wrap:anywhere]"
    );
    expect(screen.getByText(description)).toHaveClass(
      "max-w-full",
      "break-words",
      "[overflow-wrap:anywhere]"
    );
  });
});
