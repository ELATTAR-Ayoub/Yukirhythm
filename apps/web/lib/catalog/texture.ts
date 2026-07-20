import { TEXTURE_NAMES, type TextureName } from "@/components/studio/Texture";

/**
 * Assigns a texture from an id with no storage lookup and no coordination —
 * the same track resolves to the same texture on every client and session.
 * FNV-1a: small, stable, and not a security boundary.
 */
export function textureForId(id: string): TextureName {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return TEXTURE_NAMES[hash % TEXTURE_NAMES.length];
}
