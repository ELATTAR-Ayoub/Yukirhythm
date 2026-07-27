"use client";

import { CopyIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Share targets open an intent page with the link prefilled. Deliberately
 * *not* a post: the destination still asks the user to confirm, so clicking
 * one here publishes nothing on their behalf.
 */
const TARGETS = [
  {
    id: "x",
    label: "X",
    href: (url: string, text: string) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    href: (url: string, text: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
];

/** Absolute where possible, so a link copied from a preview deploy points back
 *  at that deploy rather than at production. */
export function absoluteUrl(path: string): string {
  return typeof window === "undefined"
    ? path
    : `${window.location.origin}${path}`;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being shared — shown in the heading, quoted. */
  title: string;
  url: string;
  /** Prefilled copy for the share targets. */
  text: string;
}

/**
 * One share surface for everything shareable — a playlist or a track.
 *
 * The link is shown, not merely copied: it is inspectable before it goes
 * anywhere, and still recoverable by hand if the clipboard is unavailable.
 */
export default function ShareDialog({
  open,
  onOpenChange,
  title,
  url,
  text,
}: ShareDialogProps) {
  const copy = async () => {
    // Not every context grants clipboard access (insecure origin, denied
    // permission), and a silent failure would look like a successful copy.
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy — select the link above and copy it manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share “{title}”</DialogTitle>
          <DialogDescription>
            Copy the link, or open it in an app to post yourself.
          </DialogDescription>
        </DialogHeader>

        <p className="type-code break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          {url}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="default" onClick={copy}>
            <CopyIcon className="mr-2 h-3.5 w-3.5" /> Copy link
          </Button>
          {TARGETS.map((t) => (
            <Button key={t.id} variant="outline" asChild>
              <a
                href={t.href(url, text)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t.label}
              </a>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
