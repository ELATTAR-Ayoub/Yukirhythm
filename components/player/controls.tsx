"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import Image from "next/image";
import ReactPlayer from "react-player";

// styles
import styles from "@/styles/index";
import "@/styles/player.css";

// constants
import { Owner, Audio } from "@/constants/interfaces";

// components
import SolidSvg from "@/components/SolidSVG";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// redux
import {
  selectAudioConfig,
  selectCurrentAudio,
  selectAudioPlaying,
  selectAudioLoading,
  selectAudioVolume,
  SKIP_NEXT,
  SKIP_PREV,
  SET_LOADING,
  SET_PLAYING,
} from "@/store/AudioConfig";
import { useDispatch, useSelector } from "react-redux";

const Controls = ({ videoId }: { videoId: string }) => {
  // redux
  const audioConfig = useSelector(selectAudioConfig);
  const current = useSelector(selectCurrentAudio);
  const playing = useSelector(selectAudioPlaying);
  const AudioLoading = useSelector(selectAudioLoading);
  const volume = useSelector(selectAudioVolume);
  const dispatch = useDispatch();

  // player config
  const [looping, setLooping] = useState(false);
  const [shuffling, setShuffling] = useState(false);
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
      dispatch(SET_PLAYING(false));
      return;
    }

    if (looping === true) {
      dispatch(SET_PLAYING(true));
      return;
    }

    skipAudio(1);
  }

  function seektoBegining() {
    setDuration(0);
    dispatch(SET_PLAYING(false));
    setTimeout(() => {
      dispatch(SET_PLAYING(true));
    }, 1000);
  }

  function skipAudio(change: number) {
    if (change === 0) {
      dispatch(SKIP_PREV(1));
      setDuration(0);
    } else {
      dispatch(SKIP_NEXT(1));
      setDuration(0);
    }
  }

  const handleOnBuffer = () => {
    dispatch(SET_LOADING(!AudioLoading));
  };

  const handlePlayPause = () => {
    dispatch(SET_PLAYING(!playing));
  };

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div className={`relative w-full ${styles.flexCenter} flex-col gap-0`}>
      {/* main buttons */}
      <div className={`${styles.flexStart} gap-4`}>
        {/* player */}
        <div className=" hidden">
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
                  loop: 1,
                  mute: 0,
                },
              },
            }}
            playing={playing}
            width={0}
            height={0}
            volume={volume}
            onBuffer={() => handleOnBuffer()}
            onPlay={() => dispatch(SET_PLAYING(true))}
            onPause={() => dispatch(SET_PLAYING(false))}
            onEnded={() => handleOnEnded()}
            onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
            onDuration={(duration) => setDuration(duration)}
          />
        </div>

        <Button
          onClick={() => skipAudio(0)}
          disabled={current === 0}
          size="icon"
        >
          <span className={` icon_clothes`}>
            <Image
              className={`object-contain w-4 aspect-square `}
              width={24}
              height={24}
              src={"/svgs/previous.svg"}
              alt={"disc"}
            ></Image>
          </span>
        </Button>

        <Button onClick={handlePlayPause} size="icon">
          <span className={` icon_clothes`}>
            <Image
              className={`object-contain w-4 aspect-square `}
              width={24}
              height={24}
              src={`/svgs/${playing ? "pause.svg" : "play.svg"}`}
              alt={"disc"}
            ></Image>
          </span>
        </Button>

        <Button
          onClick={() => skipAudio(1)}
          disabled={audioConfig.length - 1 === current}
          size="icon"
        >
          <span className={` icon_clothes`}>
            <Image
              className={`object-contain w-4 aspect-square `}
              width={24}
              height={24}
              src={"/svgs/next.svg"}
              alt={"disc"}
            ></Image>
          </span>
        </Button>
      </div>

      {/* time and slider */}
      <div
        className={`${styles.flexCenter} flex-col w-full gap-1 time_slider pt-4`}
      >
        <div className={`AudioSeekBar ${styles.flexCenter}`}>
          <input
            aria-label="Seek bar"
            className="w-full SeekBar"
            id="AudioSeekBar"
            type="range"
            min={0}
            max={duration}
            value={currentTime}
            onChange={(e) => handleJumpTo(parseFloat(e.target.value))}
          />
        </div>

        <p className={` ${styles.normal}  font-semibold cursor-default`}>
          {`${Math.floor(currentTime / 60)
            .toString()
            .padStart(1, "0")}:${Math.floor(currentTime % 60)
            .toString()
            .padStart(2, "0")}`}{" "}
          <span className={` font-normal text-dark-shade-15`}>
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
