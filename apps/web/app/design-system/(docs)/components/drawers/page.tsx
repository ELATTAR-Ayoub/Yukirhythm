"use client";

import { useState } from "react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import { Button } from "@/components/ui/button";
import PlaylistDrawer from "@/components/studio/screens/PlaylistDrawer";
import CreatePlaylistDrawer from "@/components/studio/screens/CreatePlaylistDrawer";
import {
  LIKED_SONGS,
  type MockCollection,
} from "@/components/studio/screens/mock-data";

function Demos() {
  const [collection, setCollection] = useState<MockCollection | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <h1 className="type-h1 mb-8">Drawers</h1>

      <DsSection index="01" title="PlaylistDrawer">
        <StatePanel
          name="PlaylistDrawer — 95vh detail"
          signal="collection_open"
          views={{
            default: (
              <Button onClick={() => setCollection(LIKED_SONGS)}>
                Open Liked Songs
              </Button>
            ),
          }}
        />
      </DsSection>

      <DsSection index="02" title="CreatePlaylistDrawer">
        <StatePanel
          name="CreatePlaylistDrawer — 90vh form"
          signal="collection_create"
          views={{
            default: (
              <Button onClick={() => setCreating(true)}>
                Open create form
              </Button>
            ),
          }}
        />
      </DsSection>

      <PlaylistDrawer
        collection={collection}
        onOpenChange={(o) => {
          if (!o) setCollection(null);
        }}
      />
      <CreatePlaylistDrawer open={creating} onOpenChange={setCreating} />
    </div>
  );
}

export default function DrawersComponentsPage() {
  return (
    <MockStudioProvider>
      <Demos />
    </MockStudioProvider>
  );
}
