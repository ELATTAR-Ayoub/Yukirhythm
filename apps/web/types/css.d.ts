// Ambient declaration for global (non-CSS-Module) stylesheet imports.
//
// Next.js ships declarations for "*.module.css" only (see
// next/types/global.d.ts). Plain side-effect imports like
// `import "@/styles/player.css"` had no declaration, which TypeScript
// silently tolerated under the legacy moduleResolution=node10. Under
// moduleResolution=bundler it reports TS2882 ("Cannot find module or type
// declarations for side-effect import"), so the stylesheets are declared here.
//
// The body is intentionally empty: these are side-effect imports handled by the
// bundler and they export nothing, so no `any` is introduced.
//
// NOTE: if CSS Modules are ever adopted, add a "*.module.css" declaration to
// this file rather than relying on Next's, since equally-specific wildcard
// module patterns resolve in declaration order.
declare module "*.css" {}
