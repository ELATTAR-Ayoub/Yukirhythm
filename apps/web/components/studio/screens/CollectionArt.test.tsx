import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import CollectionArt from "./CollectionArt";
import { getTrack, registerStudioTracks } from "./mock-data";

/** Pulls the `/textures/NAME.png` name out of every element's inline
 *  `background-image`, in DOM order — the honest signal for "which texture
 *  rendered where" since Texture sets it via inline style, not a class. */
function renderedTextures(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[style]"))
    .map((el) => el.style.backgroundImage.match(/textures\/([\w-]+)\.png/)?.[1])
    .filter((x): x is string => Boolean(x));
}

const T1 = getTrack("t1")!; // tx-k2-vinyl
const T2 = getTrack("t2")!; // tx-k-marble
const T3 = getTrack("t3")!; // tx-k2-static
const T4 = getTrack("t4")!; // tx-k-silk

describe("CollectionArt", () => {
  it("falls back to the texture swatch when cover is undefined (legacy collections)", () => {
    const { container } = render(
      <CollectionArt
        collection={{ texture: "tx-k-marble", trackIds: [] }}
        className="w-20 h-20"
      />
    );
    expect(renderedTextures(container)).toEqual(["tx-k-marble"]);
  });

  it("falls back to the texture swatch when cover is mosaic but there are no tracks", () => {
    const { container } = render(
      <CollectionArt
        collection={{ texture: "tx-k-marble", cover: "mosaic", trackIds: [] }}
        className="w-20 h-20"
      />
    );
    expect(renderedTextures(container)).toEqual(["tx-k-marble"]);
  });

  it("renders a single full-bleed texture for a one-track mosaic", () => {
    const { container } = render(
      <CollectionArt
        collection={{
          texture: "tx-k-silk",
          cover: "mosaic",
          trackIds: [T1.id],
        }}
        className="w-20 h-20"
      />
    );
    expect(renderedTextures(container)).toEqual([T1.texture]);
  });

  it("splits a two-track mosaic into two halves, in track order", () => {
    const { container } = render(
      <CollectionArt
        collection={{
          texture: "tx-k-silk",
          cover: "mosaic",
          trackIds: [T2.id, T1.id],
        }}
        className="w-20 h-20"
      />
    );
    expect(renderedTextures(container)).toEqual([T2.texture, T1.texture]);
  });

  it("gives the lead track a double-height tile in a three-track mosaic", () => {
    const { container } = render(
      <CollectionArt
        collection={{
          texture: "tx-k-silk",
          cover: "mosaic",
          trackIds: [T3.id, T1.id, T2.id],
        }}
        className="w-20 h-20"
      />
    );
    expect(renderedTextures(container)).toEqual([
      T3.texture,
      T1.texture,
      T2.texture,
    ]);
    const lead = container.querySelector<HTMLElement>("[style]");
    expect(lead?.className).toContain("row-span-2");
  });

  it("uses a 2x2 grid of the first four tracks, ignoring any beyond that", () => {
    const { container } = render(
      <CollectionArt
        collection={{
          texture: "tx-k-silk",
          cover: "mosaic",
          trackIds: [T1.id, T2.id, T3.id, T4.id, "t5"],
        }}
        className="w-20 h-20"
      />
    );
    expect(renderedTextures(container)).toEqual([
      T1.texture,
      T2.texture,
      T3.texture,
      T4.texture,
    ]);
  });

  it("renders the collection's own cover image when it has one", () => {
    const { container } = render(
      <CollectionArt
        collection={{
          texture: "tx-k-silk",
          cover: "image",
          artUrl: "https://cdn/cover.jpg",
          trackIds: [],
        }}
      />
    );
    expect(
      container.querySelector('img[src="https://cdn/cover.jpg"]')
    ).toBeTruthy();
  });

  it("composes the mosaic from the tracks' real thumbnails", () => {
    registerStudioTracks([
      {
        id: "m1",
        title: "One",
        artist: "A",
        texture: "tx-k-silk",
        durationSec: 1,
        artUrl: "https://cdn/1.jpg",
      },
      {
        id: "m2",
        title: "Two",
        artist: "B",
        texture: "tx-k-marble",
        durationSec: 1,
        artUrl: "https://cdn/2.jpg",
      },
    ]);

    const { container } = render(
      <CollectionArt
        collection={{
          texture: "tx-k-silk",
          cover: "mosaic",
          trackIds: ["m1", "m2"],
        }}
      />
    );
    expect(
      container.querySelector('img[src="https://cdn/1.jpg"]')
    ).toBeTruthy();
    expect(
      container.querySelector('img[src="https://cdn/2.jpg"]')
    ).toBeTruthy();
  });

  it("falls back per cell when only some tracks have artwork", () => {
    registerStudioTracks([
      {
        id: "m3",
        title: "Three",
        artist: "C",
        texture: "tx-k-silk",
        durationSec: 1,
        artUrl: "https://cdn/3.jpg",
      },
      {
        id: "m4",
        title: "Four",
        artist: "D",
        texture: "tx-k-marble",
        durationSec: 1,
      },
    ]);

    const { container } = render(
      <CollectionArt
        collection={{
          texture: "tx-k-silk",
          cover: "mosaic",
          trackIds: ["m3", "m4"],
        }}
      />
    );
    // One real image, one texture cell — not an empty square.
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});
