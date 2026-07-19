/**
 * The centred column shared by every screen that is NOT part of the `(app)`
 * route group — the screens index, auth, credits, terms. `(app)` routes get
 * their own full-viewport grid from `AppShellLayout`, which cannot share this
 * frame: its `max-w-6xl mx-auto` would cap the grid's width and fight the
 * `md:h-screen` layout. This used to live directly in `screens/layout.tsx`
 * and wrap every screen indiscriminately; it was pushed down here so it only
 * applies where it still belongs.
 *
 * Auth's TextureBackground sizes itself against these exact padding values
 * (see the comment in `screens/auth/page.tsx`) — changing them changes that
 * calc().
 */
export default function ScreensFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  // top spacing always equals edge spacing — 8px on small screens
  return <div className="relative max-w-6xl mx-auto p-2 sm:p-6">{children}</div>;
}
