import { cn } from "@/lib/utils";

// Dithered/ASCII texture assets shipped in public/textures (owner branding pack).
export const TEXTURE_NAMES = [
  "tx-k-ascii-ripple",
  "tx-k-glitch",
  "tx-k-marble",
  "tx-k-ripple",
  "tx-k-silk",
  "tx-k2-ascii-eq",
  "tx-k2-bars",
  "tx-k2-checker",
  "tx-k2-horizon",
  "tx-k2-marble-dense",
  "tx-k2-static",
  "tx-k2-topo",
  "tx-k2-vinyl",
] as const;

export type TextureName = (typeof TEXTURE_NAMES)[number];

interface TextureProps {
  name: TextureName;
  /** Keep the chunky dithered pixels crisp when scaled up */
  pixelated?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Renders a branding texture as a covering background layer.
 * Used for placeholder artwork, page backdrops and empty states.
 */
export default function Texture({
  name,
  pixelated = true,
  className,
  children,
}: TextureProps) {
  return (
    <div
      className={cn("bg-cover bg-center", className)}
      style={{
        backgroundImage: `url(/textures/${name}.png)`,
        imageRendering: pixelated ? "pixelated" : undefined,
      }}
    >
      {children}
    </div>
  );
}
