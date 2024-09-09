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
  SET_CURRENT,
  DELETE_ITEM,
} from "@/store/AudioConfig";
import { useDispatch, useSelector } from "react-redux";

const Controls = () => {
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
  const [ListOpen, setListOpen] = useState(false);

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

  const handleDelete = (id: string) => {
    console.log(id);

    dispatch(DELETE_ITEM(id));
  };

  const handlePlayPause = () => {
    dispatch(SET_PLAYING(!playing));
  };

  return (
    <div
      className={`fixed w-full sm:w-auto min-w-[300px] xl:min-w-min min-h-[325px] max-h-[400px] xl:right-[${
        ListOpen ? "0px" : "-26rem"
      }] right-1/2 xl:-translate-x-0 translate-x-1/2  bottom-[${
        ListOpen ? "0px" : "-16rem"
      }] top-auto xl:top-1/2 xl:-translate-y-1/2 bg-dark-shade-85 
        flex justify-start items-center flex-col xl:flex-row gap-3 px-4 py-6 AudioList z-20 player_shadow transition-all duration-700`}
    >
      {/* Controles */}

      <div className={`${styles.flexCenter} flex-row xl:flex-col gap-8  `}>
        <Button
          onClick={() => skipAudio(0)}
          disabled={current === 0}
          size="icon"
        >
          <span className={` icon_clothes`}>
            <Image
              className={`object-contain w-3 aspect-square `}
              width={24}
              height={24}
              src={"/svgs/previous.svg"}
              alt={"disc"}
            ></Image>
          </span>
        </Button>

        <Button
          onClick={handlePlayPause}
          size="icon"
          disabled={audioConfig.length == 0}
        >
          <span className={` icon_clothes`}>
            <Image
              className={`object-contain w-3 aspect-square `}
              width={24}
              height={24}
              src={`/svgs/${playing ? "pause.svg" : "play.svg"}`}
              alt={"disc"}
            ></Image>
          </span>
        </Button>

        <Button
          onClick={() => skipAudio(1)}
          disabled={
            audioConfig.length - 1 === current || audioConfig.length == 0
          }
          size="icon"
        >
          <span className={` icon_clothes`}>
            <Image
              className={`object-contain w-3 aspect-square `}
              width={24}
              height={24}
              src={"/svgs/next.svg"}
              alt={"disc"}
            ></Image>
          </span>
        </Button>

        <Button
          onClick={() => {
            setListOpen(!ListOpen);
          }}
          size="icon"
        >
          <span className={` icon_clothes`}>
            <Image
              className={`object-contain w-3 aspect-square `}
              width={24}
              height={24}
              src={"/svgs/menu.svg"}
              alt={"disc"}
            ></Image>
          </span>
        </Button>
      </div>

      {/* seperator */}

      <div className=" h-[1px] xl:h-48 w-48 xl:w-[1px] bg-dark-shade-50 opacity-50 rounded-full"></div>

      {/* Audio list */}
      <div
        className={`${styles.flexStart} flex-col h-full gap-2 overflow-auto `}
      >
        {/* All audios */}
        {audioConfig[current] &&
          audioConfig.map((audio, index) => (
            <div
              className={` w-full xl:w-96 h-16 ${styles.flexCenter} pr-3 gap-4 bg-primary-black rounded-full AudioCard`}
            >
              {/* disk */}
              <div
                className={` ${
                  current == index && playing
                    ? "discRotation"
                    : " discRotation animation-state-pause"
                }  h-full aspect-square rounded-full bg-primary-black overflow-hidden ${
                  styles.flexCenter
                }`}
              >
                {/* disk middle */}
                <div
                  className={` w-6 aspect-square center-in-parent disc_shadow rounded-full `}
                >
                  <Image
                    className={`object-contain w-full h-full `}
                    width={12}
                    height={12}
                    src={"/svgs/disc_middle.svg"}
                    alt={"disc"}
                  ></Image>
                </div>
                {/* disk img */}
                <div
                  className={`  Disk_img transition-all duration-700 h-full aspect-video z-[-1] pointer-events-none`}
                >
                  <img
                    className={` w-full h-full object-cover relative `}
                    src={
                      audioConfig[index] ? audioConfig[index].thumbnails[0] : ""
                    }
                    alt="audio_thumbnails"
                  />
                </div>
              </div>

              {/* Audio info */}
              <div
                className={`${styles.flexCenter} flex-col gap-1 text-center flex-1`}
              >
                <Link
                  href={audioConfig[index]?.owner?.canonicalURL || ""}
                  target="_"
                  title={audioConfig[index]?.owner?.name || ""}
                  className={` ${styles.XXsmall} text-primary-white ellipsis-on-1line `}
                >
                  {audioConfig[index]?.owner?.name || "Welcome!"}
                </Link>
                <p
                  title={audioConfig[index]?.title || ""}
                  className={` ${styles.XXsmall} font-semibold text-primary-white cursor-default ellipsis-on-1line`}
                >
                  {audioConfig[index]?.title || "Search below"}
                </p>
              </div>

              {/* Controls */}
              <div className={`${styles.flexStart}  gap-2`}>
                <Button
                  onClick={() => {
                    dispatch(SET_CURRENT(index));
                    if (current === index) {
                      dispatch(SET_PLAYING(!playing));
                    }
                  }}
                  size="icon"
                >
                  <span className={` icon_clothes`}>
                    <Image
                      className={`object-contain w-3 aspect-square `}
                      width={24}
                      height={24}
                      src={`/svgs/${
                        current == index && playing ? "pause.svg" : "play.svg"
                      }`}
                      alt={"disc"}
                    ></Image>
                  </span>
                </Button>
                <Button onClick={() => handleDelete(audio.ID)} size="icon">
                  <span className={` icon_clothes`}>
                    <Image
                      className={`object-contain w-3 aspect-square `}
                      width={24}
                      height={24}
                      src={"/svgs/delete.svg"}
                      alt={"disc"}
                    ></Image>
                  </span>
                </Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Controls;
