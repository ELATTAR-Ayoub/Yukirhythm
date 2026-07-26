"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";

interface BackHeaderProps {
  title: string;
  fallbackHref: string;
}

type NavigationHistoryEntryLike = {
  index: number;
  url: string | null;
};

type NavigationLike = {
  currentEntry?: NavigationHistoryEntryLike;
  entries: () => NavigationHistoryEntryLike[];
};

/**
 * Prefer the Navigation API when available: unlike `history.length`, it lets
 * us verify that the immediately preceding entry belongs to this origin.
 * Older browsers fall back to the only signal they expose.
 */
function hasSafePreviousEntry() {
  const navigation = (window as typeof window & { navigation?: NavigationLike })
    .navigation;
  const currentEntry = navigation?.currentEntry;

  if (navigation && currentEntry) {
    const previousEntry = navigation
      .entries()
      .find((entry) => entry.index === currentEntry.index - 1);

    if (!previousEntry?.url) return false;

    try {
      return new URL(previousEntry.url).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  return window.history.length > 1;
}

/** Sub-screen header — browser back chevron + title. */
export default function BackHeader({ title, fallbackHref }: BackHeaderProps) {
  const router = useRouter();

  const handleBack = (event: MouseEvent<HTMLAnchorElement>) => {
    // Preserve standard link behavior for modified clicks.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (hasSafePreviousEntry()) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <header className="flex items-center gap-2 mb-6">
      <Button variant="ghost" size="icon" asChild aria-label="Back">
        <Link href={fallbackHref} onClick={handleBack}>
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>
      </Button>
      {/* Same type as PageHeader's title — a sub-screen header and a top-level
          one sat at different sizes, so moving between them changed the
          heading size for no reason. */}
      <h1 className="type-h2 text-2xl sm:text-3xl truncate">{title}</h1>
    </header>
  );
}
