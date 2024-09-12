"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import Image from "next/image";

// styles
import styles from "@/styles/index";
import "@/styles/hero.css";
import "@/styles/player.css";

// constants
import { Owner, Audio } from "@/constants/interfaces";

// Icons
import { MagnifyingGlassIcon, UpdateIcon } from "@radix-ui/react-icons";

// components
import SolidSvg from "@/components/SolidSVG";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Controls from "@/components/player/controls";
import AudioList from "@/components/player/AudioList";
import { ListDrawer } from "@/components/player/ListDrawer";

// redux
import {
  selectAudioConfig,
  selectCurrentAudio,
  selectAudioPlaying,
  selectAudioLoading,
  selectAudioVolume,
  SET_PLAYING,
  ADD_ITEM,
  SET_VOLUME,
} from "@/store/AudioConfig";
import { useDispatch, useSelector } from "react-redux";

const Hero = () => {
  // call redux states
  const audioConfig = useSelector(selectAudioConfig);
  const current = useSelector(selectCurrentAudio);
  const volume = useSelector(selectAudioVolume);
  const audioPlaying = useSelector(selectAudioPlaying);
  const audioLoading = useSelector(selectAudioLoading);
  const dispatch = useDispatch();

  // value
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  // function

  const searchAudio = (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setLoading(true);
    //
    if (inputValue) {
      fetch("/api/searchEngine", {
        method: "POST",
        body: JSON.stringify({ string: `${inputValue} music or podcast` }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data: Audio) => {
          dispatch(ADD_ITEM(data));
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
    //
    setInputValue("");
  };

  return (
    <section
      className={` relative flex sm:justify-center justify-end items-center flex-col w-full h-screen overflow-hidden p-4 `}
    >
      <section
        className={`relative player_shadow bg-card ${styles.flexEnd} sm:pt-44 pt-4 pb-4 px-4 max-w-[300px] w-full h-auto sm:rounded-[60px] rounded-[42px] overflow-hidden `}
      >
        {/* audio disc rotating */}
        <div
          className={` ${
            audioConfig.length === 0 && " pointer-events-none"
          } Disc ${styles.flexCenter}`}
        >
          <div
            className={`Middle_Disc transition-all duration-700 sm:w-16 w-20 aspect-square center-in-parent disc_shadow rounded-full `}
          >
            <Image
              className={`object-contain w-full h-full ${
                audioPlaying ? "discRotation" : ""
              } `}
              width={24}
              height={24}
              src={"/svgs/disc_middle.svg"}
              alt={"disc"}
            ></Image>
          </div>

          <div
            className={` ${
              audioPlaying
                ? "discRotation"
                : " discRotation animation-state-pause"
            } Disk_img transition-all duration-700 h-full aspect-video z-[-1] pointer-events-none`}
          >
            <img
              className={` w-full h-full object-cover relative `}
              src={
                audioConfig[current] ? audioConfig[current].thumbnails[0] : ""
              }
              alt="audio_thumbnails"
            />
          </div>

          <div
            className={`absolute px-12 left-1/2 -translate-x-1/2 bottom-8 disc_info opacity-0 pointer-events-none w-full ${styles.flexCenter} flex-col gap-3 transition-all duration-300 `}
          >
            {/* sound waves */}

            <div className={` soundwaves ${audioPlaying && "active"}`}>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>

            {/* disc info */}
            <div className={`${styles.flexCenter} flex-col gap-1 text-center`}>
              <Link
                href={audioConfig[current]?.owner?.canonicalURL || ""}
                target="_"
                title={audioConfig[current]?.owner?.name || "Welcome!"}
                className={` ${styles.Xsmall} text-primary ellipsis-on-1line `}
              >
                {audioConfig[current]?.owner?.name || "Welcome!"}
              </Link>
              <p
                title={audioConfig[current]?.title || "Search below"}
                className={` ${styles.Xsmall} font-semibold text-primary cursor-default ellipsis-on-2line`}
              >
                {audioConfig[current]?.title || "Search below"}
              </p>
            </div>
          </div>
        </div>

        {/* main contorls */}
        <div
          className={`relative w-full ${styles.flexEndCenter} flex-col gap-3 `}
        >
          {/* sound waves */}

          <div className={` soundwaves ${audioPlaying && "active"}`}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>

          {/* title and channel */}
          <div className={`${styles.flexCenter} flex-col gap-1 text-center`}>
            <Link
              href={audioConfig[current]?.owner?.canonicalURL || ""}
              target="_"
              title={audioConfig[current]?.owner?.name || "Welcome!"}
              className={` ${styles.Xsmall} text-primary ellipsis-on-1line `}
            >
              {audioConfig[current]?.owner?.name || "Welcome!"}
            </Link>
            <p
              title={audioConfig[current]?.title || "Search below"}
              className={` ${styles.normal} font-semibold ellipsis-on-2line`}
            >
              {audioConfig[current]?.title || "Search below"}
            </p>
          </div>

          {/*Controls */}

          {
            <Controls
              videoId={audioConfig[current] ? audioConfig[current].ID : ""}
            />
          }

          {/* search bar */}
          <form
            onSubmit={searchAudio}
            className={`${styles.flexCenter} SearchAudioForm gap-1 w-full max-w-[250px]`}
          >
            <Input
              onChange={(e) => {
                setInputValue(e.target.value);
              }}
              value={inputValue}
              className={` h-8 w-0 p-0 border-0 delay-200 duration-500 `}
              type="text"
              required
              placeholder="Search"
            />
            <Button className=" flex-none" size="icon">
              <span className={` icon_clothes`}>
                {loading ? (
                  <UpdateIcon className="h-3 w-3 animate-spin" />
                ) : (
                  <MagnifyingGlassIcon className="h-3 w-3" />
                )}
              </span>
            </Button>
          </form>
        </div>
      </section>
    </section>
  );
};

export default Hero;
