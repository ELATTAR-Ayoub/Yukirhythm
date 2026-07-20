import Link from "next/link";
import { ChevronLeftIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";

interface BackHeaderProps {
  title: string;
  backHref: string;
}

/** Sub-screen header — back chevron + title. */
export default function BackHeader({ title, backHref }: BackHeaderProps) {
  return (
    <header className="flex items-center gap-2 mb-6">
      <Button variant="ghost" size="icon" asChild aria-label="Back">
        <Link href={backHref}>
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
