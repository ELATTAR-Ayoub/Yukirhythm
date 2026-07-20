"use client";

import {
  EnterFullScreenIcon,
  ExitFullScreenIcon,
  SpeakerLoudIcon,
  SpeakerModerateIcon,
  SpeakerOffIcon,
  SpeakerQuietIcon,
} from "@radix-ui/react-icons";

import IconSwap from "@/components/studio/IconSwap";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { Slider } from "@/components/ui/slider";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import LikeButton from "@/components/studio/screens/LikeButton";
import { useFullscreen } from "./useFullscreen";

/**
 * Speaker faces in strip order, quietest first — IconSwap rolls the strip, so
 * the order is the animation: raising the volume rolls the icon one way and
 * lowering it rolls back the other.
 */
const SPEAKER_ICONS = {
  off: <SpeakerOffIcon />,
  quiet: <SpeakerQuietIcon />,
  moderate: <SpeakerModerateIcon />,
  loud: <SpeakerLoudIcon />,
};

/** Which face a level shows. Four steps, so the icon reads as a meter. */
function speakerFace(volume: number): keyof typeof SPEAKER_ICONS {
  if (volume === 0) return "off";
  if (volume < 0.34) return "quiet";
  if (volume < 0.67) return "moderate";
  return "loud";
}

const FULLSCREEN_ICONS = {
  enter: <EnterFullScreenIcon />,
  exit: <ExitFullScreenIcon />,
};

/**
 * The playback bar's right-hand controls: output level and fullscreen.
 *
 * These fill the block that used to be an empty spacer, so the transport
 * stays optically centred — the spacer existed to balance the left block's
 * width, and real controls of the same footprint do that job honestly.
 *
 * Volume stays live whether or not a track is loaded: it is an output
 * setting, not a property of the current track, and a user should be able to
 * set it before pressing play. That is why this is not gated on `nowPlaying`
 * the way the seek bar and transport are.
 */
export default function PlayerExtras() {
  const { volume, setVolume, muted, toggleMute, nowPlaying } = useMockStudio();
  const fullscreen = useFullscreen();

  return (
    <div className="flex items-center justify-end gap-2 min-w-0">
      {/* Only with a track loaded — liking nothing is not a state. */}
      {nowPlaying ? (
        <LikeButton trackId={nowPlaying.id} trackTitle={nowPlaying.title} />
      ) : null}

      <PlayerButton
        variant="secondary"
        size="sm"
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
        onClick={toggleMute}
        data-signal="volume_mute"
      >
        <IconSwap active={speakerFace(volume)} icons={SPEAKER_ICONS} />
      </PlayerButton>

      <Slider
        value={[volume]}
        max={1}
        step={0.01}
        onValueChange={(v) => setVolume(v[0])}
        aria-label="Volume"
        data-signal="volume"
        className="w-24 shrink-0"
      />

      {/* Hidden rather than disabled where the API is unavailable (an embedded
          frame under a permissions policy, or jsdom): a control that can
          never work is noise, not information. */}
      {fullscreen.supported ? (
        <PlayerButton
          variant="secondary"
          size="sm"
          aria-label={fullscreen.active ? "Exit full screen" : "Full screen"}
          aria-pressed={fullscreen.active}
          onClick={fullscreen.toggle}
          data-signal="fullscreen"
        >
          <IconSwap
            active={fullscreen.active ? "exit" : "enter"}
            icons={FULLSCREEN_ICONS}
          />
        </PlayerButton>
      ) : null}
    </div>
  );
}
