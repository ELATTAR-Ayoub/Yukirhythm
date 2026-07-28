"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CircleSpinner } from "@/components/studio/PlayerButton";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import SignInRequiredDialog from "@/components/studio/screens/SignInRequiredDialog";
import type { PublicPlaylist } from "@/lib/sharing/public";

export default function SaveSharedPlaylistButton({
  playlist,
}: {
  playlist: PublicPlaylist;
}) {
  const { user, createCollectionAsync } = useMockStudio();
  const [signInRequired, setSignInRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!user) {
      setSignInRequired(true);
      return;
    }
    if (saving || saved) return;

    setSaving(true);
    const toastId = toast.loading("Saving playlist to your library...");
    try {
      await createCollectionAsync({
        title: playlist.title,
        desc: playlist.description,
        tags: playlist.tags,
        kind: "music",
        texture: playlist.texture,
        cover: playlist.cover,
        artUrl: playlist.cover === "image" ? playlist.artUrl : undefined,
        trackIds: playlist.tracks.map((track) => track.id),
      });
      setSaved(true);
      toast.success("Playlist saved to your library", { id: toastId });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Please try again.";
      toast.error(`Couldn't save the playlist: ${reason}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant={saved ? "outline" : "default"}
        size="sm"
        disabled={saving || saved}
        onClick={() => void save()}
      >
        {saving ? (
          <span className="mr-2 h-3.5 w-3.5">
            <CircleSpinner />
          </span>
        ) : saved ? (
          <CheckIcon className="mr-2 h-3.5 w-3.5" />
        ) : (
          <CopyIcon className="mr-2 h-3.5 w-3.5" />
        )}
        {saving ? "Saving..." : saved ? "Saved" : "Save playlist"}
      </Button>
      {signInRequired ? (
        <SignInRequiredDialog
          open
          onOpenChange={setSignInRequired}
          action="save this playlist"
        />
      ) : null}
    </>
  );
}
