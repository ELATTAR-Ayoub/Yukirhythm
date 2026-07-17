# Deck Carousel 3D — Design Spec

**Date:** 2026-07-17
**Branch:** `v2-deck-carousel` (forked from `v2-design-studio`, isolated worktree)
**Status:** Approved by owner

## Goal

Rebuild the vinyl deck as a cinematic Three.js scene with a realistic
carousel swap choreography on next/previous, an 80s anime retrotech look
(dark stage, Studio-blue key light, grain/distortion/scanlines), delivered
on a standalone preview page. Integration into the home page happens only
after the owner confirms the preview.

## Non-goals

- No wiring to the real Zustand player store yet (`/deck-lab` uses mock data).
- No audio playback on the preview page.
- No mobile-specific layout work beyond the canvas resizing sanely.

## Preview page

`apps/web/app/deck-lab/page.tsx`

- Full-screen scene, mock queue of ~5 tracks. Disc labels use the existing
  PNGs in `apps/web/public/textures/`.
- DOM overlay (not in-canvas): track title, artist, prev/play/next controls,
  "NOW SPINNING" caption — current typographic style (OffBit/Satoshi).
- The scene component takes a clean props interface so later integration is
  a drop-in:

```ts
// Reuses the branch's existing DeckTrack type ({ title, artist, artUrl? })
interface CarouselDeckProps {
  tracks: DeckTrack[];
  className?: string;
}
// The inner scene receives { tracks, current, playing, glitch } plus
// handle-registration callbacks; swapping is driven by the choreography
// hook, so store integration later only needs to render <CarouselDeck>
// with real tracks and observe its callbacks.
```

## Scene & lighting — 80s anime retrotech

- Frontal diorama: center platter with tonearm; previous disc floats in a
  left slot, next disc in a right slot.
- Dark stage `#111111`–`#191919` with fog.
- Key light tinted Studio blue `#1450F0` from upper-right; cool rim light
  for edge highlights on vinyl; dim white fill.
- Green `#7DF08A` sparingly: power LED, tonearm tip glow.
- Discs: procedural groove rings with moving specular streaks, label
  texture centered.
- Camera: fixed frontal; the deck group lerps a few degrees toward the
  cursor (parallax). Side discs react on hover and are clickable to
  trigger the corresponding swap.

## Swap choreography (GSAP master timeline, ~2.2 s)

Mirrored for previous. Phases overlap slightly for natural motion:

1. Tonearm lifts off the groove, swings out.
2. Playing disc lifts: slight scale-up + rise; spin decelerates to stop.
3. Lifted disc arcs left into the previous slot while the incoming disc
   travels in from the right, rotating to seat itself as it approaches
   center.
4. Incoming disc settles onto the platter: scales down with a small
   landing bounce.
5. Tonearm swings back and drops onto the lead-in groove.
6. Spin ramps up like a motor reaching RPM (eased spin-up).

**Mash-proof:** pressing next/prev mid-swap fast-forwards (kills to end
state) the running timeline before starting the new one. GSAP overwrite
semantics handle this.

## Retro post-processing stack

`@react-three/postprocessing` EffectComposer:

- Animated film grain (noise)
- Subtle chromatic aberration, stronger toward frame edges
- Faint scanlines
- Vignette
- Low bloom (blue highlights, LEDs)
- Glitch/distortion burst fired only during swaps (VHS tracking-error)

## Architecture

New files live beside the existing prototype under
`apps/web/components/studio/deck/` (the branch's established location).
The prototype `DeckScene.tsx`/`DiscDeck.tsx` stay untouched so the
design-system page keeps working; the carousel build is parallel.

| File | Responsibility |
| --- | --- |
| `components/studio/deck/CarouselDeckScene.tsx` | Canvas, camera, lights, fog, parallax rig, WebGL fallback |
| `components/studio/deck/Disc.tsx` | Vinyl mesh, groove material, label texture, spin inertia, hover |
| `components/studio/deck/Tonearm.tsx` | Tonearm model + pivot rig (GSAP-driven, no self-animation) |
| `components/studio/deck/slots.ts` | Slot transforms + pure slot-assignment math |
| `components/studio/deck/choreography-math.ts` | Pure helpers: index wrap, seat-rotation target |
| `components/studio/deck/useDeckChoreography.ts` | GSAP master timeline; exposes `swap(direction)`, `togglePlay` |
| `components/studio/deck/Effects.tsx` | Post-processing stack |
| `components/studio/deck/CarouselDeck.tsx` | State, disc-handle registry, DOM overlay UI |
| `app/deck-lab/page.tsx` | Mock data + page shell |

## Dependencies

Correction (2026-07-17): this branch is on **Next 14 / React 18.2**, so
fiber v8 + drei v9 are already the correct pairing — no framework bumps.

- Keep `@react-three/fiber` ^8, `@react-three/drei` ^9, `three` ^0.170.
- Add `@react-three/postprocessing` **^2** (the fiber-8-compatible line)
  and `gsap` ^3.

## Error handling

- WebGL unavailable → keep the prototype's DOM fallback message.
- Label textures on the preview page are local, committed PNGs; a
  network-thumbnail fallback (plain colored label) is an
  integration-phase concern, out of scope here.

## Verification

- Dev server + browser: screenshots of idle state and mid-swap state.
- Console free of WebGL/React errors.
- Render smoke test for the page component.
- FPS sanity check (target 60, no sustained drops during swaps).
