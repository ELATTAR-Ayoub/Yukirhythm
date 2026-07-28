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
  it("uses the same bottom-up entrance and exit as a normal dialog", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm action</AlertDialogTitle>
          <AlertDialogDescription>
            Review before continuing.
          </AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    );

    const content = screen.getByRole("alertdialog");
    expect(content).toHaveClass(
      "duration-200",
      "data-[state=open]:fade-in-0",
      "data-[state=closed]:fade-out-0",
      "data-[state=open]:slide-in-from-bottom-8",
      "data-[state=closed]:slide-out-to-bottom-8"
    );
    expect(content).not.toHaveClass(
      "data-[state=open]:zoom-in-95",
      "data-[state=open]:slide-in-from-left-1/2",
      "data-[state=open]:slide-in-from-top-[48%]"
    );
  });

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
