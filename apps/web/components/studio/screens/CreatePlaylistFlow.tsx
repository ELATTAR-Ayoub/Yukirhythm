"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerButton } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";
import DataText from "@/components/studio/DataText";
import Texture, { TEXTURE_NAMES, type TextureName } from "@/components/studio/Texture";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { TagChip } from "./TagChip";
import CollectionArt from "./CollectionArt";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  getTrack,
  searchMockTracks,
  type CollectionKind,
  type MockCollection,
  type MockTrack,
} from "./mock-data";

interface CreatePlaylistFlowProps {
  /** Fired after a successful create, with the new collection — the caller
   *  decides what happens next (the create route navigates straight to it). */
  onCreated: (collection: MockCollection) => void;
}

/** Draft state for the whole wizard, held here rather than in the store —
 *  nothing here is written to `collections` until step 3's confirm. Field
 *  names mirror `MockCollection` (texture/cover/trackIds) on purpose: it
 *  lets the draft stand in directly wherever a collection-shaped prop is
 *  expected, e.g. CollectionArt's live mosaic preview on review. */
interface Draft {
  title: string;
  desc: string;
  tags: string[];
  kind: CollectionKind;
  texture: TextureName;
  cover: "texture" | "mosaic";
  trackIds: string[];
}

const DEFAULT_TEXTURE: TextureName = "tx-k-silk";

const EMPTY_DRAFT: Draft = {
  title: "",
  desc: "",
  tags: [],
  kind: "music",
  texture: DEFAULT_TEXTURE,
  cover: "texture",
  trackIds: [],
};

const STEP_LABELS = ["Details", "Add music", "Review"] as const;
type Step = 1 | 2 | 3;

/** "tx-k2-ascii-eq" -> "ascii eq" — readable enough for a swatch's
 *  accessible name; sighted users tell swatches apart by the texture image. */
function textureLabel(name: TextureName): string {
  return name.replace(/^tx-k2?-/, "").replace(/-/g, " ");
}

/**
 * Three numbered steps + a connecting rule. Labels hide below `sm` so the
 * indicator stays a row of legible, tappable circles at 393px instead of
 * wrapping or squeezing text.
 */
function StepIndicator({ step }: { step: Step }) {
  return (
    <ol aria-label="Progress" className="flex items-center">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 font-label text-[10px] uppercase tracking-wider shrink-0",
                active
                  ? "text-primary"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground"
              )}
            >
              <DataText
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] shrink-0",
                  active
                    ? "border-primary text-primary"
                    : done
                      ? "border-foreground"
                      : "border-border"
                )}
              >
                {n}
              </DataText>
              <span className="hidden sm:inline">{label}</span>
            </span>
            {i < STEP_LABELS.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "mx-2 h-px flex-1",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

interface TagsFieldProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Type a tag, press Enter to turn it into a chip; Backspace on an empty
 * field pops the last chip back off — the same shortcut most tag pickers
 * use, and it falls out naturally here since the field already tracks
 * whether it's empty for the placeholder text.
 *
 * Trimmed and lowercased on add (matches the old comma-separated field's
 * behaviour), blanks ignored, duplicates rejected.
 */
function TagsField({ tags, onChange }: TagsFieldProps) {
  const [value, setValue] = useState("");

  const commit = () => {
    const t = value.trim().toLowerCase();
    setValue("");
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="pl-tags">Tags</Label>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-2xl border border-input bg-card px-3 py-1.5 shadow-pressed",
          "transition-[box-shadow,border-color] duration-base",
          "focus-within:ring-2 focus-within:ring-ring/35 focus-within:border-primary/50"
        )}
      >
        {tags.map((tag) => (
          <TagChip key={tag} label={tag} onRemove={() => removeTag(tag)} />
        ))}
        <input
          id="pl-tags"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && value === "" && tags.length > 0) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          placeholder={tags.length === 0 ? "lofi, night, focus…" : "Add another…"}
          className="min-w-[96px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}

interface DetailsStepProps {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}

/** Step 1 — name, description, type, tags, cover. */
function DetailsStep({ draft, setDraft }: DetailsStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pl-title">Name</Label>
        <Input
          id="pl-title"
          required
          placeholder="Rainy Tapes"
          value={draft.title}
          onChange={(e) =>
            setDraft((d) => ({ ...d, title: e.target.value }))
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pl-desc">Description</Label>
        <Input
          id="pl-desc"
          placeholder="What's the mood?"
          value={draft.desc}
          onChange={(e) => setDraft((d) => ({ ...d, desc: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <div className="flex gap-2">
          <TagChip
            label="Music"
            active={draft.kind === "music"}
            onClick={() => setDraft((d) => ({ ...d, kind: "music" }))}
          />
          <TagChip
            label="Podcast"
            active={draft.kind === "podcast"}
            onClick={() => setDraft((d) => ({ ...d, kind: "podcast" }))}
          />
        </div>
      </div>

      <TagsField
        tags={draft.tags}
        onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
      />

      <div className="space-y-1.5">
        <Label id="pl-cover-label">Cover</Label>
        <div role="group" aria-labelledby="pl-cover-label" className="space-y-2.5">
          <div className="flex gap-2">
            <TagChip
              label="Texture"
              active={draft.cover === "texture"}
              onClick={() => setDraft((d) => ({ ...d, cover: "texture" }))}
            />
            <TagChip
              label="Mosaic"
              active={draft.cover === "mosaic"}
              disabled={draft.trackIds.length === 0}
              onClick={() => setDraft((d) => ({ ...d, cover: "mosaic" }))}
            />
          </div>

          {draft.trackIds.length === 0 ? (
            <p className="type-muted">
              Add tracks in the next step to build a mosaic cover.
            </p>
          ) : null}

          {draft.cover === "texture" ? (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
              {TEXTURE_NAMES.map((name) => {
                const active = draft.texture === name;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Cover: ${textureLabel(name)}`}
                    onClick={() => setDraft((d) => ({ ...d, texture: name }))}
                    className={cn(
                      "aspect-square rounded-md overflow-hidden border-2 transition-colors duration-fast",
                      active
                        ? "border-primary"
                        : "border-transparent hover:border-border"
                    )}
                  >
                    <Texture name={name} className="w-full h-full" />
                  </button>
                );
              })}
            </div>
          ) : draft.trackIds.length > 0 ? (
            <CollectionArt
              collection={draft}
              className="h-28 w-28 rounded-lg border border-border overflow-hidden"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface AddMusicStepProps {
  trackIds: string[];
  onToggleTrack: (trackId: string) => void;
}

/** Step 2 — search the catalogue and toggle tracks into the draft. Nothing
 *  here touches the store; `onToggleTrack` only updates local draft state.
 *  Skippable: an empty selection is a valid playlist. */
function AddMusicStep({ trackIds, onToggleTrack }: AddMusicStepProps) {
  const [q, setQ] = useState("");

  const results = useMemo(() => (q.trim() ? searchMockTracks(q) : []), [q]);
  const selected = useMemo(
    () =>
      trackIds
        .map(getTrack)
        .filter((t): t is MockTrack => t !== undefined),
    [trackIds]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label>Add music</Label>
        <span
          aria-label={`${trackIds.length} ${trackIds.length === 1 ? "track" : "tracks"} added`}
          className="text-sm text-muted-foreground"
        >
          <DataText>{trackIds.length}</DataText>{" "}
          {trackIds.length === 1 ? "track" : "tracks"} added
        </span>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tracks, artists…"
          aria-label="Search tracks to add"
          className="pl-9"
        />
      </div>

      {q.trim() ? (
        results.length === 0 ? (
          <EmptyState
            title="No matches"
            hint="Try a different title or artist."
            texture="tx-k2-static"
          />
        ) : (
          <div className="space-y-1">
            {results.map((track, i) => {
              const added = trackIds.includes(track.id);
              return (
                <div key={track.id} className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <TrackRow
                      index={i + 1}
                      title={track.title}
                      artist={track.artist}
                      duration={formatDuration(track.durationSec)}
                      texture={track.texture}
                      playable={false}
                    />
                  </div>
                  <PlayerButton
                    variant={added ? "primary" : "outline"}
                    size="sm"
                    aria-label={added ? `Remove ${track.title}` : `Add ${track.title}`}
                    onClick={() => onToggleTrack(track.id)}
                  >
                    <IconSwap
                      active={added ? "added" : "add"}
                      icons={{ add: <PlusIcon />, added: <CheckIcon /> }}
                    />
                  </PlayerButton>
                </div>
              );
            })}
          </div>
        )
      ) : selected.length === 0 ? (
        <EmptyState
          title="Search to add"
          hint="Find a track by title or artist — or skip this step."
          texture="tx-k-ascii-ripple"
        />
      ) : (
        <div className="space-y-1">
          {selected.map((track) => (
            <div key={track.id} className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                <TrackRow
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  playable={false}
                />
              </div>
              <PlayerButton
                variant="ghost"
                size="sm"
                aria-label={`Remove ${track.title}`}
                onClick={() => onToggleTrack(track.id)}
              >
                <Cross2Icon />
              </PlayerButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Step 3 — everything that's about to be written, and the one control
 *  (Create playlist) that actually writes it. */
function ReviewStep({ draft }: { draft: Draft }) {
  const tags = draft.tags;
  const tracks = useMemo(
    () =>
      draft.trackIds
        .map(getTrack)
        .filter((t): t is MockTrack => t !== undefined),
    [draft.trackIds]
  );
  const title = draft.title.trim();
  const desc = draft.desc.trim();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <CollectionArt
          collection={draft}
          className="w-20 h-20 rounded-lg shrink-0 border border-border overflow-hidden"
        />
        <div className="min-w-0">
          <div className="type-h3 truncate">{title || "Untitled"}</div>
          <div className="font-label text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {draft.kind}
          </div>
        </div>
      </div>

      {desc ? <p className="type-muted">{desc}</p> : null}

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label>Tracks</Label>
          <span
            aria-label={`${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`}
            className="text-sm text-muted-foreground"
          >
            <DataText>{tracks.length}</DataText>{" "}
            {tracks.length === 1 ? "track" : "tracks"}
          </span>
        </div>
        {tracks.length === 0 ? (
          <EmptyState
            title="No tracks yet"
            hint="You can add music later from the playlist page."
            texture="tx-k2-static"
          />
        ) : (
          <div className="space-y-1">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                index={i + 1}
                title={track.title}
                artist={track.artist}
                duration={formatDuration(track.durationSec)}
                texture={track.texture}
                playable={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The create-playlist wizard: details -> add music -> review. Step and draft
 * state live here (not in sub-routes) — deep-linking a half-filled wizard is
 * meaningless, and this keeps the whole flow reachable at every width without
 * inventing history entries for it. Nothing reaches the store
 * (`useMockStudio().createCollection`) until the review step's confirm.
 */
export default function CreatePlaylistFlow({ onCreated }: CreatePlaylistFlowProps) {
  const { createCollection } = useMockStudio();
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const canAdvance = step !== 1 || draft.title.trim().length > 0;

  const toggleTrack = (trackId: string) => {
    setDraft((d) => ({
      ...d,
      trackIds: d.trackIds.includes(trackId)
        ? d.trackIds.filter((id) => id !== trackId)
        : [...d.trackIds, trackId],
    }));
  };

  const handleCreate = () => {
    const title = draft.title.trim();
    if (!title) return;
    const created = createCollection({
      title,
      desc: draft.desc.trim(),
      tags: draft.tags,
      kind: draft.kind,
      texture: draft.texture,
      cover: draft.cover,
      trackIds: draft.trackIds,
    });
    toast(`Created “${title}”`);
    onCreated(created);
  };

  // A fixed-height flex column, not `space-y-6` around three siblings: the
  // step indicator (header) and the Back/Next/Create row (footer) are both
  // `shrink-0` and stay put, and only the middle step content scrolls —
  // `flex-1 min-h-0` is what lets that middle region claim exactly the
  // remaining height and become the sole scroller instead of overflowing
  // into the page column's own scroller (see CreatePlaylistScreen, which
  // gives this component a definite height to divide up in the first
  // place; without that ancestor chain `h-full` here would resolve to
  // nothing and every child would fall back to natural document flow).
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 pb-6">
        <StepIndicator step={step} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {step === 1 ? (
          <DetailsStep draft={draft} setDraft={setDraft} />
        ) : step === 2 ? (
          <AddMusicStep trackIds={draft.trackIds} onToggleTrack={toggleTrack} />
        ) : (
          <ReviewStep draft={draft} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 pt-4">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            Back
          </Button>
        ) : null}
        {step < 3 ? (
          <Button
            type="button"
            className="flex-1"
            disabled={!canAdvance}
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            Next
          </Button>
        ) : (
          <Button type="button" className="flex-1" onClick={handleCreate}>
            Create playlist
          </Button>
        )}
      </div>
    </div>
  );
}
