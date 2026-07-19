"use client";

import { useState } from "react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import DevicePlayer from "@/components/studio/screens/DevicePlayer";
import MiniPlayerBar from "@/components/studio/screens/MiniPlayerBar";
import QueueDrawer from "@/components/studio/screens/QueueDrawer";
import { Button } from "@/components/ui/button";
import { MOCK_TRACKS } from "@/components/studio/screens/mock-data";

function Seed() {
  const { play, nowPlaying } = useMockStudio();
  if (nowPlaying) return null;
  return (
    <Button size="sm" onClick={() => play(MOCK_TRACKS[0])}>
      Load a track
    </Button>
  );
}

export default function PlayerComponentsPage() {
  return (
    <MockStudioProvider>
      <div>
        <h1 className="type-h1 mb-8">Player</h1>
        <Seed />

        <DsSection index="01" title="DevicePlayer">
          <StatePanel
            name="DevicePlayer — expanded surface"
            signal="player_expand / transport"
            views={{
              default: (
                <div className="flex justify-center">
                  <DevicePlayer />
                </div>
              ),
              "with collapse": (
                <div className="flex justify-center">
                  <DevicePlayer onCollapse={() => undefined} />
                </div>
              ),
            }}
          />
        </DsSection>

        <DsSection index="02" title="MiniPlayerBar">
          <StatePanel
            name="MiniPlayerBar — compressed surface"
            signal="player_expand, seek"
            views={{
              default: (
                <div className="relative h-24 rounded-lg border border-border overflow-hidden [&>div]:absolute [&>div]:bottom-2">
                  <MiniPlayerBar onExpand={() => undefined} />
                </div>
              ),
            }}
          />
        </DsSection>

        <DsSection index="03" title="QueueDrawer">
          <StatePanel
            name="QueueDrawer — what's playing now"
            signal="queue_open"
            views={{
              default: <QueueDrawerDemo />,
            }}
          />
        </DsSection>
      </div>
    </MockStudioProvider>
  );
}

/** The queue sheet is a drawer, so the gallery drives it from a trigger. */
function QueueDrawerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-center py-4">
      <Button size="sm" onClick={() => setOpen(true)}>
        Open queue
      </Button>
      <QueueDrawer open={open} onOpenChange={setOpen} />
    </div>
  );
}
