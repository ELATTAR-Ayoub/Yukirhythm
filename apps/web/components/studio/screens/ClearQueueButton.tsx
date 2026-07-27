"use client";

import { useState } from "react";
import { TrashIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { CircleSpinner } from "@/components/studio/PlayerButton";
import { useMockStudio } from "./MockStudioProvider";

/**
 * Destructive control for the ad-hoc Up Next queue. Its only app consumer is
 * the guarded `/queue` route; playlists never render this component.
 */
export default function ClearQueueButton() {
  const { queue, clearQueue } = useMockStudio();
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!clearing) setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label="Clear queue"
          title="Clear queue"
          disabled={queue.length === 0}
          data-signal="queue_clear_open"
          className="lg:w-auto lg:px-3"
        >
          <TrashIcon />
          <span className="hidden lg:ml-2 lg:inline">Clear queue</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear your queue?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes every song from Up next and stops playback. Your
            playlists will not be changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Keep songs</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={clearing}
            onClick={async (event) => {
              event.preventDefault();
              setClearing(true);
              try {
                await clearQueue();
                toast.success("Queue cleared");
                setOpen(false);
              } catch (error) {
                console.error("Failed to clear queue", error);
                toast.error("Could not clear the queue");
              } finally {
                setClearing(false);
              }
            }}
            data-signal="queue_clear_confirm"
          >
            {clearing ? (
              <>
                <span
                  role="status"
                  aria-label="Clearing queue"
                  className="mr-2 h-4 w-4 [&_svg]:h-4 [&_svg]:w-4"
                >
                  <CircleSpinner />
                </span>
                Clearing…
              </>
            ) : (
              "Clear queue"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
