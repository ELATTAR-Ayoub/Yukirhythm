"use client";

import { useState, useRef } from "react";
import ReactPlayer from "react-player";
import { toast } from "sonner";

// styles
import styles from "@/styles/index";
import "@/styles/player.css";

// Icons
import {
  LoopIcon,
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from "@radix-ui/react-icons";

// components
import { Button } from "@/components/ui/button";
import { ListDrawer } from "./ListDrawer";

// store
import { usePlayerStore } from "@/store/player";
import { Slider } from "../ui/slider";

const Controls = ({ videoId }: { videoId: string }) => {
  // store
  const audioConfig = usePlayerStore((s) => s.audioState);
  const current = usePlayerStore((s) => s.currentAudio);
  const playing = usePlayerStore((s) => s.audioPlaying);
  const AudioLoading = usePlayerStore((s) => s.audioLoading);
  const volume = usePlayerStore((s) => s.audioVolume);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrev = usePlayerStore((s) => s.skipPrev);
  const setLoading = usePlayerStore((s) => s.setLoading);
  const setPlaying = usePlayerStore((s) => s.setPlaying);

  // player config
  const [looping, setLooping] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ref
  const playerRef = useRef<ReactPlayer>(null);

  // fun
  function handleJumpTo(time: number) {
    setCurrentTime(time);
    playerRef.current?.seekTo(time);
  }

  function handleOnEnded() {
    if (audioConfig.length === current || current + 1 === audioConfig.length) {
      setPlaying(false);
      return;
    }

    if (looping === true) {
      setPlaying(true);
      return;
    }

    skipAudio(1);
  }

  function skipAudio(change: number) {
    if (change === 0) {
      skipPrev(1);
      setDuration(0);
    } else {
      skipNext(1);
      setDuration(0);
    }
  }

  const handleBufferStart = () => {
    setLoading(true);
  };

  const handleBufferEnd = () => {
    setLoading(false);
  };

  const handleReady = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    toast("This video can't be played here — skipping.");
    if (current + 1 < audioConfig.length) {
      skipAudio(1);
    } else {
      setPlaying(false);
    }
  };

  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div className={`relative w-full ${styles.flexCenter} flex-col gap-0`}>
      {/* main buttons */}
      <div className={`${styles.flexStart} gap-3`}>
        {/* player — mounted only with a real video, else react-player falls
            back to a file <video> with a bogus src and log-spams the console */}
        <div className=" hidden">
          {videoId ? (
          <ReactPlayer
            ref={playerRef}
            url={youtubeUrl}
            loop={looping}
            config={{
              youtube: {
                playerVars: {
                  showinfo: 0,
                  modestbranding: 1,
                  playsinline: 1,
                  controls: 0,
                  rel: 0,
                  fs: 0,
                  disablekb: 1,
                  iv_load_policy: 3,
                  autohide: 1,
                  loop: 1,
                  mute: 0,
                  progressInterval: 1000,
                },
              },
            }}
            playing={playing}
            width={0}
            height={0}
            volume={volume}
            onReady={handleReady}
            onBuffer={handleBufferStart}
            onBufferEnd={handleBufferEnd}
            onError={handleError}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => handleOnEnded()}
            onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
            onDuration={(duration) => setDuration(duration)}
          />
          ) : null}
        </div>

        <Button
          size="icon"
          variant={`${looping ? "default" : "outline"}`}
          onClick={() => {
            setLooping(!looping);
          }}
          disabled={audioConfig.length == 0}
        >
          <span className={` icon_clothes`}>
            <LoopIcon className="h-3 w-3 " />
          </span>
        </Button>

        <Button
          onClick={() => skipAudio(0)}
          disabled={current === 0}
          size="icon"
          variant={"secondary"}
        >
          <span className={` icon_clothes`}>
            <TrackPreviousIcon className="h-3 w-3 " />
          </span>
        </Button>

        <Button
          onClick={handlePlayPause}
          size="icon"
          disabled={audioConfig.length == 0}
          variant={"secondary"}
        >
          <span className={` icon_clothes`}>
            {AudioLoading ? (
              <LoopIcon className="h-3 w-3 animate-spin" />
            ) : playing ? (
              <PauseIcon className="h-3 w-3 " />
            ) : (
              <PlayIcon className="h-3 w-3" />
            )}
          </span>
        </Button>

        <Button
          onClick={() => skipAudio(1)}
          variant={"secondary"}
          disabled={
            audioConfig.length - 1 === current || audioConfig.length == 0
          }
          size="icon"
        >
          <span className={` icon_clothes`}>
            <TrackNextIcon className="h-3 w-3 " />
          </span>
        </Button>

        <ListDrawer />
      </div>

      {/* time and slider */}
      <div
        className={` ${audioConfig.length === 0 && " pointer-events-none"} ${
          styles.flexCenter
        } flex-col w-full gap-1 time_slider pt-4`}
      >
        <div className={`AudioSeekBar ${styles.flexCenter}`}>
          <Slider
            value={[currentTime]}
            defaultValue={[0]}
            onValueChange={(value) => handleJumpTo(value[0])}
            max={duration}
            step={1}
            className="rangeSlider"
          />
        </div>

        <p className={` ${styles.small}  font-semibold cursor-default `}>
          {`${Math.floor(currentTime / 60)
            .toString()
            .padStart(1, "0")}:${Math.floor(currentTime % 60)
            .toString()
            .padStart(2, "0")}`}{" "}
          <span className={` font-normal text-primary opacity-70`}>
            /{" "}
            {`${Math.floor(duration / 60)
              .toString()
              .padStart(1, "0")}:${Math.floor(duration % 60)
              .toString()
              .padStart(2, "0")}`}
          </span>{" "}
        </p>
      </div>
    </div>
  );
};

export default Controls;
