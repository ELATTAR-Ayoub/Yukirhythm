"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authHref } from "@/components/studio/shell/routes";

interface SignInRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "like songs" | "save this playlist" | "add songs to playlists";
}

/**
 * Shared guest gate for account-backed actions. The return path makes sign-in
 * resume on the public listening page that opened the dialog.
 */
export default function SignInRequiredDialog({
  open,
  onOpenChange,
  action,
}: SignInRequiredDialogProps) {
  const pathname = usePathname();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign in to continue</AlertDialogTitle>
          <AlertDialogDescription>
            You need a Yukirhythm account to {action}. After signing in,
            you&apos;ll return to this page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href={authHref(pathname)}>Sign in</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
