import Link from "next/link";

import EmptyState from "@/components/studio/EmptyState";
import { Button } from "@/components/ui/button";
import { SCREENS } from "@/components/studio/shell/routes";

/** Route base — the app lives at the root (see shell/routes.ts). */
const BASE = SCREENS;

interface SignInPromptProps {
  title?: string;
  hint?: string;
}

/** Guest gate for Library and Profile. */
export default function SignInPrompt({
  title = "Sign in to continue",
  hint = "Your library, stats and history live behind one tap.",
}: SignInPromptProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <EmptyState title={title} hint={hint} texture="tx-k2-horizon" />
      <Button asChild>
        <Link href={`${BASE}/auth`}>Sign in</Link>
      </Button>
    </div>
  );
}
