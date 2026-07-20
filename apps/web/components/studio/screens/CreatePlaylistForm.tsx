"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagChip } from "./TagChip";
import { useMockStudio } from "./MockStudioProvider";
import type { CollectionKind, MockCollection } from "./mock-data";

interface CreatePlaylistFormProps {
  /** Fired after a successful create, with the new collection — the mobile
   *  drawer just closes itself, the desktop route navigates to it. */
  onCreated: (collection: MockCollection) => void;
}

/**
 * The create-playlist form body, shared by the create route
 * (`/screens/create`, the app's flow at every width) and CreatePlaylistDrawer
 * (a sheet presentation demoed in the design-system docs). Owns the field
 * state and the submit side effects (create + toast); the caller only
 * decides what happens next.
 */
export default function CreatePlaylistForm({
  onCreated,
}: CreatePlaylistFormProps) {
  const { createCollection } = useMockStudio();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<CollectionKind>("music");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const created = createCollection({
      title: title.trim(),
      desc: desc.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      kind,
    });
    toast(`Created “${title.trim()}”`);
    setTitle("");
    setDesc("");
    setTags("");
    setKind("music");
    onCreated(created);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pl-title">Name</Label>
        <Input
          id="pl-title"
          required
          placeholder="Rainy Tapes"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pl-desc">Description</Label>
        <Input
          id="pl-desc"
          placeholder="What's the mood?"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <div className="flex gap-2">
          <TagChip
            label="Music"
            active={kind === "music"}
            onClick={() => setKind("music")}
          />
          <TagChip
            label="Podcast"
            active={kind === "podcast"}
            onClick={() => setKind("podcast")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pl-tags">Tags (comma separated)</Label>
        <Input
          id="pl-tags"
          placeholder="lofi, night, focus"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full">
        Create
      </Button>
    </form>
  );
}
