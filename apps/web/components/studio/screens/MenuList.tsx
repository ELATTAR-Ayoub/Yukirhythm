import Link from "next/link";
import { ChevronRightIcon } from "@radix-ui/react-icons";

interface MenuRowProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}

/** One hub row — icon, label + hint, chevron. */
export function MenuRow({ href, icon, label, hint }: MenuRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-secondary transition-colors duration-fast"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary text-primary shrink-0 [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-ui font-medium text-sm">{label}</span>
        {hint ? (
          <span className="block type-muted truncate mt-0.5">{hint}</span>
        ) : null}
      </span>
      <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

/** Card container for MenuRows — the Profile hub's spine. */
export function MenuList({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
      {children}
    </div>
  );
}
