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

// components
import SolidSvg from "@/components/SolidSVG";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Controls from "@/components/player/controls";

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
        body: JSON.stringify({ string: inputValue }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data: Audio) => {
          console.log("data =>>>>>");
          console.log(data);
          console.log(data.URL);
          dispatch(ADD_ITEM(data));
          console.log(audioConfig);
          setLoading(false);
          if (audioConfig.length < 1) {
            dispatch(SET_PLAYING(true));
          }
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
      className={` relative ${styles.flexCenter} flex-col w-full h-screen overflow-hidden `}
    >
      <section
        className={`relative player_shadow bg-dark-shade-85 ${styles.flexCenter} pt-52 pb-6 px-6 max-w-[350px] w-full rounded-[60px] overflow-hidden  `}
      >
        {/* audio disc rotating */}
        <div
          className={` ${
            audioConfig.length === 0 && " pointer-events-none"
          } Disc `}
        >
          <div
            className={`Middle_Disc transition-all duration-300 w-20 aspect-square center-in-parent disc_shadow rounded-full `}
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
          <img
            className={`${
              audioPlaying ? "discRotation" : ""
            } h-full object-cover relative z-[-1] transition-all pointer-events-none`}
            src={audioConfig[current] ? audioConfig[current].thumbnails[0] : ""}
            alt="audio_thumbnails"
          />

          <div
            className={`absolute px-12 left-1/2 -translate-x-1/2 bottom-8 disc_info opacity-0 pointer-events-none w-full ${styles.flexCenter} flex-col gap-4 transition-all duration-300 `}
          >
            {/* sound waves */}

            <div className={` soundwaves white ${audioPlaying && "active"}`}>
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
                className={` ${styles.Xsmall} text-primary-white  `}
              >
                {audioConfig[current]?.owner?.name || "Welcome!"}
              </Link>
              <p
                className={` ${styles.Xsmall} font-semibold text-primary-white cursor-default`}
              >
                {audioConfig[current]?.title || "Search below"}
              </p>
            </div>
          </div>
        </div>

        {/* main contorls */}
        <div className={`relative w-full ${styles.flexCenter} flex-col gap-4 `}>
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
              className={` ${styles.Xsmall} text-dark-shade-15  `}
            >
              {audioConfig[current]?.owner?.name || "Welcome!"}
            </Link>
            <p className={` ${styles.normal} font-semibold `}>
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
            className={`${styles.flexCenter} group gap-1 w-full max-w-[250px]`}
          >
            <Input
              onChange={(e) => {
                setInputValue(e.target.value);
              }}
              value={inputValue}
              className={` w-0 p-0 border-0 group-hover:w-full group-hover:px-3 group-hover:border group-hover:py-1 duration-500 `}
              type="text"
              placeholder="Search"
            />
            <Button className=" flex-none" size="icon">
              <span className={` icon_clothes`}>
                <Image
                  className={`object-contain w-4 aspect-square ${
                    loading ? " animate-spin" : ""
                  } `}
                  width={24}
                  height={24}
                  src={`/svgs/${loading ? "load.svg" : "search.svg"}`}
                  alt={"disc"}
                ></Image>
              </span>
            </Button>
          </form>
        </div>
      </section>
    </section>
  );
};

export default Hero;
