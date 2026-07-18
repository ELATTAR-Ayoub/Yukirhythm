"use client";

import { useState } from "react";
import { toast } from "sonner";

import { DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppDrawer from "./AppDrawer";
import { TagChip } from "./TagChip";
import { useMockStudio } from "./MockStudioProvider";
import type { CollectionKind } from "./mock-data";

interface CreatePlaylistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 90vh create-playlist form — the existing flow, rebranded and drawer-ized. */
export default function CreatePlaylistDrawer({
  open,
  onOpenChange,
}: CreatePlaylistDrawerProps) {
  const { createCollection } = useMockStudio();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<CollectionKind>("music");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createCollection({
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
    onOpenChange(false);
  };

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="90vh">
      <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4">
        <DrawerTitle className="type-h2">Create playlist</DrawerTitle>

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
    </AppDrawer>
  );
}
