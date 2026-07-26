import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

describe("AlertDialog", () => {
  it("keeps long content within the mobile viewport and allows text to wrap", () => {
    const title = "VeryLongAlertDialogTitle".repeat(20);
    const description = "VeryLongAlertDialogDescription".repeat(20);

    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    );

    expect(screen.getByRole("alertdialog")).toHaveClass(
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
