import {
  LoopIcon,
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
  ListBulletIcon,
} from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import SectionLabel from "@/components/studio/SectionLabel";
import DataText from "@/components/studio/DataText";
import MediaCard from "@/components/studio/MediaCard";
import TrackRow from "@/components/studio/TrackRow";
import EqIndicator from "@/components/studio/EqIndicator";
import BadgeSwitcher from "@/components/studio/BadgeSwitcher";
import RailShelf from "@/components/studio/RailShelf";
import EmptyState from "@/components/studio/EmptyState";
import { SkeletonCard, SkeletonRow } from "@/components/studio/Skeletons";
import YukiAgent from "@/components/agent/YukiAgent";
import { PlayerButton } from "@/components/studio/PlayerButton";
import DiscDeck from "@/components/studio/DiscDeck";
import IconSwap from "@/components/studio/IconSwap";
import IconSwapDemo from "@/components/studio/ds/IconSwapDemo";

/** Labeled demo cell — the thing on top, its name written under it. */
function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center min-h-[44px]">{children}</div>
      <span className="type-label text-muted-foreground">{label}</span>
    </div>
  );
}

/** The transport cluster, rebuilt on the PlayerButton component. */
function TransportCluster({
  playing = false,
  loading = false,
  disabled = false,
  looping = false,
}: {
  playing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  looping?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <PlayerButton
        variant={looping ? "primary" : "outline"}
        active={looping}
        disabled={disabled}
      >
        <LoopIcon />
      </PlayerButton>
      <PlayerButton disabled={disabled}>
        <TrackPreviousIcon />
      </PlayerButton>
      <PlayerButton
        variant="primary"
        size="lg"
        loading={loading}
        disabled={disabled}
      >
        <IconSwap
          active={playing ? "pause" : "play"}
          icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
        />
      </PlayerButton>
      <PlayerButton disabled={disabled}>
        <TrackNextIcon />
      </PlayerButton>
      <PlayerButton variant="outline" disabled={disabled}>
        <ListBulletIcon />
      </PlayerButton>
    </div>
  );
}

export default function ComponentsPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="font-display font-bold text-3xl tracking-tight">
          Components
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          The living inventory. Name top-left, states top-right — click a state
          chip to flip the component through its lives. Each panel notes the
          data signal it emits for the recommendation engine.
        </p>
      </div>

      {/* ── 01 Your buttons ─────────────────────────────────────── */}
      <DsSection index="01" title="Buttons (yours)">
        <StatePanel
          name="Button — all variants"
          signal="varies by action"
          views={{
            default: (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                <Labeled label="default"><Button>Play now</Button></Labeled>
                <Labeled label="secondary"><Button variant="secondary">Add to playlist</Button></Labeled>
                <Labeled label="outline"><Button variant="outline">Follow</Button></Labeled>
                <Labeled label="ghost"><Button variant="ghost">Skip</Button></Labeled>
                <Labeled label="link"><Button variant="link">See all</Button></Labeled>
                <Labeled label="destructive"><Button variant="destructive">Delete</Button></Labeled>
              </div>
            ),
            disabled: (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                <Labeled label="default"><Button disabled>Play now</Button></Labeled>
                <Labeled label="secondary"><Button variant="secondary" disabled>Add to playlist</Button></Labeled>
                <Labeled label="outline"><Button variant="outline" disabled>Follow</Button></Labeled>
                <Labeled label="ghost"><Button variant="ghost" disabled>Skip</Button></Labeled>
                <Labeled label="link"><Button variant="link" disabled>See all</Button></Labeled>
                <Labeled label="destructive"><Button variant="destructive" disabled>Delete</Button></Labeled>
              </div>
            ),
            sizes: (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                <Labeled label="lg"><Button size="lg">Large</Button></Labeled>
                <Labeled label="default"><Button size="default">Default</Button></Labeled>
                <Labeled label="sm"><Button size="sm">Small</Button></Labeled>
                <Labeled label="icon"><Button size="icon" variant="secondary"><span className="icon_clothes"><PlayIcon className="h-3 w-3" /></span></Button></Labeled>
                <Labeled label="smallIcon"><Button size="smallIcon" variant="outline"><span className="icon_clothes"><PlayIcon className="h-2.5 w-2.5" /></span></Button></Labeled>
              </div>
            ),
          }}
        />

        <StatePanel
          name="PlayerButton — transport control"
          signal="play, pause, skip, loop"
          views={{
            variants: (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                <Labeled label="primary"><PlayerButton variant="primary" size="lg"><PlayIcon /></PlayerButton></Labeled>
                <Labeled label="secondary"><PlayerButton><TrackNextIcon /></PlayerButton></Labeled>
                <Labeled label="outline"><PlayerButton variant="outline"><LoopIcon /></PlayerButton></Labeled>
                <Labeled label="ghost"><PlayerButton variant="ghost"><ListBulletIcon /></PlayerButton></Labeled>
              </div>
            ),
            sizes: (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                <Labeled label="sm"><PlayerButton size="sm"><PlayIcon /></PlayerButton></Labeled>
                <Labeled label="base"><PlayerButton size="base"><PlayIcon /></PlayerButton></Labeled>
                <Labeled label="lg"><PlayerButton size="lg"><PlayIcon /></PlayerButton></Labeled>
                <Labeled label="xl"><PlayerButton variant="primary" size="xl"><PlayIcon /></PlayerButton></Labeled>
              </div>
            ),
            states: (
              <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                <Labeled label="default"><PlayerButton><PlayIcon /></PlayerButton></Labeled>
                <Labeled label="loading"><PlayerButton loading><PlayIcon /></PlayerButton></Labeled>
                <Labeled label="active"><PlayerButton variant="outline" active><LoopIcon /></PlayerButton></Labeled>
                <Labeled label="disabled"><PlayerButton disabled><PlayIcon /></PlayerButton></Labeled>
              </div>
            ),
          }}
        />

        <StatePanel
          name="DiscDeck — 3D turntable carousel"
          signal="disc_next, disc_prev, play, pause"
          views={{
            default: (
              <DiscDeck
                tracks={[
                  { title: "literal world", artist: "KISIDAKYOUDAN", texture: "tx-k-ripple" },
                  { title: "Nightglow", artist: "TANYA CHUA", texture: "tx-k2-horizon" },
                  { title: "夜盲症", artist: "蔡健雅 TANYA CHUA", texture: "tx-k-silk" },
                  { title: "A.D. Police Opening", artist: "KISIDAKYOUDAN", texture: "tx-k-glitch" },
                  { title: "Static Garden", artist: "YUKI WEEKLY", texture: "tx-k2-static" },
                ]}
              />
            ),
          }}
        />

        <StatePanel
          name="IconSwap — the multi-icon rule"
          signal="follows the host control"
          views={{
            default: (
              <div className="grid gap-5">
                <IconSwapDemo />
                <p className="type-muted max-w-xl">
                  RULE: every control that alternates between icons — play/pause,
                  mute, like, expand — swaps them through IconSwap. The old icon
                  rolls up and out, the new one drops down into place. No
                  crossfades, no instant swaps.
                </p>
              </div>
            ),
          }}
        />

        <StatePanel
          name="Transport cluster — your player buttons"
          signal="play, pause, skip, loop, queue_open"
          views={{
            paused: <TransportCluster />,
            playing: <TransportCluster playing />,
            loading: <TransportCluster loading />,
            looping: <TransportCluster looping />,
            disabled: <TransportCluster disabled />,
          }}
        />

        <StatePanel
          name="Surface treatments — your shadow system"
          views={{
            default: (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  ["main_shadow", "buttons, chips"],
                  ["AudioCard", "audio tiles"],
                  ["player_shadow", "player shell"],
                  ["disc_shadow", "vinyl disc"],
                ].map(([cls, use]) => (
                  <div key={cls} className="flex flex-col items-center gap-3">
                    <div
                      className={`${cls} w-24 h-24 rounded-2xl ${
                        cls === "disc_shadow" ? "rounded-full" : ""
                      }`}
                    />
                    <div className="text-center">
                      <div className="font-label text-[10px]">{cls}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {use}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ),
          }}
        />
      </DsSection>

      {/* ── 02 Primitives ───────────────────────────────────────── */}
      <DsSection index="02" title="Primitives">
        <StatePanel
          name="Input"
          signal="search_query"
          views={{
            default: (
              <div className="max-w-sm">
                <Input placeholder="Search your rhythm…" />
              </div>
            ),
            filled: (
              <div className="max-w-sm">
                <Input defaultValue="kisidakyoudan literal world" />
              </div>
            ),
            disabled: (
              <div className="max-w-sm">
                <Input placeholder="Disabled" disabled />
              </div>
            ),
          }}
        />

        <StatePanel
          name="Badge"
          views={{
            default: (
              <div className="flex flex-wrap gap-2">
                <Badge>New release</Badge>
                <Badge variant="secondary">Podcast</Badge>
                <Badge variant="outline">Weekly pick</Badge>
                <Badge variant="destructive">Removed</Badge>
              </div>
            ),
          }}
        />

        <StatePanel
          name="Tabs"
          signal="tab_switch"
          views={{
            default: (
              <Tabs defaultValue="liked" className="max-w-md">
                <TabsList>
                  <TabsTrigger value="liked">Liked</TabsTrigger>
                  <TabsTrigger value="playlists">Playlists</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="liked"
                  className="text-sm text-muted-foreground pt-3"
                >
                  Liked music lives here.
                </TabsContent>
                <TabsContent
                  value="playlists"
                  className="text-sm text-muted-foreground pt-3"
                >
                  Playlists live here.
                </TabsContent>
                <TabsContent
                  value="history"
                  className="text-sm text-muted-foreground pt-3"
                >
                  History lives here.
                </TabsContent>
              </Tabs>
            ),
          }}
        />

        <StatePanel
          name="Slider — seek / volume"
          signal="seek, volume_change"
          views={{
            default: (
              <div className="max-w-sm">
                <Slider defaultValue={[62]} max={100} step={1} />
              </div>
            ),
            empty: (
              <div className="max-w-sm">
                <Slider defaultValue={[0]} max={100} step={1} />
              </div>
            ),
            full: (
              <div className="max-w-sm">
                <Slider defaultValue={[100]} max={100} step={1} />
              </div>
            ),
          }}
        />

        <StatePanel
          name="Avatar"
          views={{
            default: (
              <div className="flex gap-3">
                <Avatar>
                  <AvatarFallback className="font-ui font-bold">YR</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback className="bg-cobalt text-snow font-ui font-bold">
                    MJ
                  </AvatarFallback>
                </Avatar>
              </div>
            ),
          }}
        />
      </DsSection>

      {/* ── 03 Card system ──────────────────────────────────────── */}
      <DsSection index="03" title="Card system">
        <StatePanel
          name="MediaCard — boxy"
          signal="card_play, card_open"
          views={{
            default: (
              <div className="flex flex-wrap items-start gap-6">
                <div>
                  <MediaCard
                    size="sm"
                    title="literal world"
                    artist="Kisidakyoudan"
                    texture="tx-k-ripple"
                    duration="3:59"
                  />
                  <div className="type-label text-muted-foreground mt-2 max-w-[144px]">
                    sm — dense rails (recently played)
                  </div>
                </div>
                <div>
                  <MediaCard
                    size="md"
                    title="Nightglow"
                    artist="Tanya Chua"
                    texture="tx-k2-horizon"
                    duration="4:12"
                  />
                  <div className="type-label text-muted-foreground mt-2 max-w-[192px]">
                    md — standard grids (library, search)
                  </div>
                </div>
                <div>
                  <MediaCard
                    size="lg"
                    title="Music of the Week"
                    artist="Curated by Yuki"
                    texture="tx-k2-horizon"
                  />
                  <div className="type-label text-muted-foreground mt-2 max-w-[256px]">
                    lg — feature spots (weekly picks, moods)
                  </div>
                </div>
              </div>
            ),
            playing: (
              <div className="flex flex-wrap items-end gap-5">
                <MediaCard
                  size="sm"
                  title="literal world"
                  artist="Kisidakyoudan"
                  texture="tx-k-ripple"
                  duration="3:59"
                  playing
                />
                <MediaCard
                  size="md"
                  title="Nightglow"
                  artist="Tanya Chua"
                  texture="tx-k2-horizon"
                  duration="4:12"
                  playing
                />
                <MediaCard
                  size="lg"
                  title="Music of the Week"
                  artist="Curated by Yuki"
                  texture="tx-k2-horizon"
                  playing
                />
              </div>
            ),
          }}
        />

        <StatePanel
          name="MediaCard — extended"
          signal="card_play"
          views={{
            default: (
              <div className="grid gap-6">
                <div>
                  <MediaCard
                    variant="extended"
                    size="md"
                    title="A.D. Police: To Protect and Serve"
                    artist="Kisidakyoudan"
                    texture="tx-k-glitch"
                    duration="2:47"
                  />
                  <div className="type-label text-muted-foreground mt-2">
                    md — queue rows, search results
                  </div>
                </div>
                <div>
                  <MediaCard
                    variant="extended"
                    size="lg"
                    title="夜盲症"
                    artist="蔡健雅 Tanya Chua"
                    texture="tx-k-silk"
                    duration="4:31"
                  />
                  <div className="type-label text-muted-foreground mt-2">
                    lg — hero rows, continue-listening banner
                  </div>
                </div>
              </div>
            ),
            playing: (
              <div className="grid gap-3">
                <MediaCard
                  variant="extended"
                  size="md"
                  title="A.D. Police: To Protect and Serve"
                  artist="Kisidakyoudan"
                  texture="tx-k-glitch"
                  duration="2:47"
                  playing
                />
              </div>
            ),
          }}
        />
      </DsSection>

      {/* ── 04 Content patterns ─────────────────────────────────── */}
      <DsSection index="04" title="Content patterns">
        <StatePanel
          name="BadgeSwitcher"
          signal="badge_switch"
          views={{
            default: (
              <BadgeSwitcher options={["All", "Music", "Podcasts", "Live"]} />
            ),
          }}
        />

        <StatePanel
          name="RailShelf"
          signal="shelf_scroll, shelf_see_all"
          views={{
            default: (
              <RailShelf
                label="01 — For you"
                title="Recently played"
                seeAllHref="#"
              >
                <MediaCard size="sm" title="literal world" artist="Kisidakyoudan" texture="tx-k-ripple" />
                <MediaCard size="sm" title="Nightglow" artist="Tanya Chua" texture="tx-k2-topo" playing />
                <MediaCard size="sm" title="Static Garden" artist="Yuki Weekly" texture="tx-k2-static" />
                <MediaCard size="sm" title="Marble Sea" artist="Aurora Set" texture="tx-k2-marble-dense" />
                <MediaCard size="sm" title="Checker Club" artist="Soft Club" texture="tx-k2-checker" />
                <MediaCard size="sm" title="Vinyl Ripple" artist="Deep Cuts" texture="tx-k2-vinyl" />
              </RailShelf>
            ),
            loading: (
              <RailShelf label="" title="" seeAllHref="#" loading>
                {null}
              </RailShelf>
            ),
          }}
        />

        <StatePanel
          name="TrackRow"
          signal="row_play, row_queue"
          views={{
            default: (
              <div className="max-w-2xl">
                <TrackRow index={1} title="literal world" artist="Kisidakyoudan" texture="tx-k-ripple" duration="3:59" />
                <TrackRow index={2} title="Nightglow (骗坏3印象曲)" artist="蔡健雅 Tanya Chua" texture="tx-k2-horizon" duration="4:12" />
                <TrackRow index={3} title="A.D. Police Opening" artist="Kisidakyoudan" texture="tx-k-glitch" duration="2:47" />
              </div>
            ),
            playing: (
              <div className="max-w-2xl">
                <TrackRow index={1} title="literal world" artist="Kisidakyoudan" texture="tx-k-ripple" duration="3:59" />
                <TrackRow index={2} title="Nightglow (骗坏3印象曲)" artist="蔡健雅 Tanya Chua" texture="tx-k2-horizon" duration="4:12" playing />
                <TrackRow index={3} title="A.D. Police Opening" artist="Kisidakyoudan" texture="tx-k-glitch" duration="2:47" />
              </div>
            ),
            selected: (
              <div className="max-w-2xl">
                <TrackRow index={1} title="literal world" artist="Kisidakyoudan" texture="tx-k-ripple" duration="3:59" selected />
                <TrackRow index={2} title="Nightglow (骗坏3印象曲)" artist="蔡健雅 Tanya Chua" texture="tx-k2-horizon" duration="4:12" />
                <TrackRow index={3} title="A.D. Police Opening" artist="Kisidakyoudan" texture="tx-k-glitch" duration="2:47" />
              </div>
            ),
            loading: (
              <div className="max-w-2xl">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ),
          }}
        />

        <StatePanel
          name="EqIndicator"
          views={{
            playing: <EqIndicator />,
            paused: <EqIndicator playing={false} />,
            recolored: (
              <span className="text-cobalt">
                <EqIndicator className="text-cobalt" />
              </span>
            ),
          }}
        />
      </DsSection>

      {/* ── 05 Feedback ─────────────────────────────────────────── */}
      <DsSection index="05" title="Feedback">
        <StatePanel
          name="EmptyState"
          views={{
            library: (
              <EmptyState
                title="NO MORE LIKED AUDIO"
                hint="Everything you like lands here. Go find something worth keeping."
                action={<Button>Explore music</Button>}
              />
            ),
            search: (
              <EmptyState
                title="NOTHING FOUND"
                texture="tx-k2-static"
                hint="Try another spelling — or ask the agent, it digs deeper."
              />
            ),
          }}
        />

        <StatePanel
          name="Data displays"
          views={{
            default: (
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
                <DataText className="text-4xl">02:07 / 03:59</DataText>
                <DataText className="text-2xl text-primary">132 BPM</DataText>
                <DataText className="text-2xl text-mint bg-ink rounded-sm px-2 py-0.5">
                  4,209 PLAYS
                </DataText>
                <SectionLabel>EST. 2026 — A LISTENING ROOM</SectionLabel>
              </div>
            ),
          }}
        />
      </DsSection>

      {/* ── 06 Agent ────────────────────────────────────────────── */}
      <DsSection index="06" title="Agent (companion preview)">
        <StatePanel
          name="Agent orb"
          signal="agent_open, agent_query"
          views={{
            idle: (
              <div className="w-16 h-16 rounded-full overflow-hidden border border-border shadow-e2 bg-ink">
                <YukiAgent state="idle" className="w-full h-full" />
              </div>
            ),
            searching: (
              <div className="w-16 h-16 rounded-full overflow-hidden border border-border shadow-e2 bg-ink">
                <YukiAgent state="searching" className="w-full h-full" />
              </div>
            ),
            playing: (
              <div className="w-16 h-16 rounded-full overflow-hidden border border-border shadow-e2 bg-ink">
                <YukiAgent state="playing" className="w-full h-full" />
              </div>
            ),
            asking: (
              <div className="w-16 h-16 rounded-full overflow-hidden border border-border shadow-e2 bg-ink">
                <YukiAgent state="asking" className="w-full h-full" />
              </div>
            ),
            success: (
              <div className="w-16 h-16 rounded-full overflow-hidden border border-border shadow-e2 bg-ink">
                <YukiAgent state="success" className="w-full h-full" />
              </div>
            ),
            error: (
              <div className="w-16 h-16 rounded-full overflow-hidden border border-border shadow-e2 bg-ink">
                <YukiAgent state="error" className="w-full h-full" />
              </div>
            ),
          }}
        />
      </DsSection>
    </div>
  );
}
