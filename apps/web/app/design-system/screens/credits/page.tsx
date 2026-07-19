import Link from "next/link";

import { TextureBackground } from "@/components/ui/texture-background";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { socialLinks } from "@/constants/index";

export default function CreditsScreen() {
  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <TextureBackground className="!w-full !h-[72vh] p-6">
        <section className="relative w-full max-w-md flex flex-col items-start gap-6 rounded-lg border border-border bg-card p-6 shadow-e3">
          <div className="flex items-center gap-3">
            <Avatar className="border border-border">
              <AvatarFallback className="bg-ink text-snow font-ui">
                EA
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="type-h4">Elattar Ayoub</h1>
              <p className="type-muted">Web &amp; Brand Designer</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {socialLinks.map((link) => (
              <Link
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                <Badge className="capitalize">{link.name}</Badge>
              </Link>
            ))}
          </div>

          <p className="type-small text-muted-foreground">
            Built with care by ELATTAR Ayoub.
          </p>
          <p className="type-small text-muted-foreground">
            Thanks to{" "}
            <Link
              className="underline hover:opacity-75"
              target="_blank"
              rel="noreferrer"
              href="https://ui.shadcn.com"
            >
              shadcn/ui
            </Link>{" "}
            and{" "}
            <Link
              className="underline hover:opacity-75"
              target="_blank"
              rel="noreferrer"
              href="https://github.com/Fabricio-191/youtube"
            >
              Fabricio-191
            </Link>{" "}
            for their fantastic libraries.
          </p>
        </section>
      </TextureBackground>
    </div>
  );
}
