"use client";

import { useState } from "react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import { TagChip, FilterChipRow } from "@/components/studio/screens/TagChip";
import ViewToggle, { type TrackView } from "@/components/studio/screens/ViewToggle";
import SortControl from "@/components/studio/screens/SortControl";
import TrackMenu from "@/components/studio/screens/TrackMenu";
import { MOCK_TRACKS } from "@/components/studio/screens/mock-data";
import { LIBRARY_FILTERS, type LibraryFilter, type TrackSort } from "@/components/studio/screens/library-utils";

function Demos() {
  const [filter, setFilter] = useState<LibraryFilter>("playlists");
  const [view, setView] = useState<TrackView>("rows");
  const [sort, setSort] = useState<TrackSort>("recent");

  return (
    <div>
      <h1 className="type-h1 mb-8">Content</h1>

      <DsSection index="01" title="Chips">
        <StatePanel
          name="TagChip / FilterChipRow"
          signal="library_filter, tag_tap"
          views={{
            default: (
              <FilterChipRow
                options={LIBRARY_FILTERS}
                value={filter}
                onChange={setFilter}
              />
            ),
            static: (
              <div className="flex gap-2">
                <TagChip label="lofi" />
                <TagChip label="night" active />
              </div>
            ),
          }}
        />
      </DsSection>

      <DsSection index="02" title="List controls">
        <StatePanel
          name="ViewToggle + SortControl"
          signal="view_switch, sort_switch"
          views={{
            default: (
              <div className="flex items-center gap-3">
                <ViewToggle view={view} onChange={setView} />
                <SortControl sort={sort} onChange={setSort} />
              </div>
            ),
          }}
        />
      </DsSection>

      <DsSection index="03" title="TrackMenu">
        <StatePanel
          name="TrackMenu"
          signal="row_share, row_add, row_like"
          views={{ default: <TrackMenu track={MOCK_TRACKS[0]} /> }}
        />
      </DsSection>
    </div>
  );
}

export default function ContentComponentsPage() {
  return (
    <MockStudioProvider>
      <Demos />
    </MockStudioProvider>
  );
}
