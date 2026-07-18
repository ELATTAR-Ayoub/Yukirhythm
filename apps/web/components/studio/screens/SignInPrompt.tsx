import Link from "next/link";

import EmptyState from "@/components/studio/EmptyState";
import { Button } from "@/components/ui/button";

const BASE = "/design-system/screens";

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
