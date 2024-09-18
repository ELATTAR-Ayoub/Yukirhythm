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
import {
  MagnifyingGlassIcon,
  PlayIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";

// components
import SolidSvg from "@/components/SolidSVG";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Controls from "@/components/player/controls";
import { ListDrawer } from "@/components/player/ListDrawer";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

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
  const playing = useSelector(selectAudioPlaying);
  const dispatch = useDispatch();

  // value
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [openSearchList, setOpenSearchList] = useState(false);
  const [searchedAudios, setSearchedAudios] = useState<Audio[]>([]);

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
        body: JSON.stringify({
          string: `${inputValue}`,
          quantity: 10,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data: Audio[]) => {
          console.log("data", data);
          setSearchedAudios(data);
          setOpenSearchList(true);
          // dispatch(ADD_ITEM(data));
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

  const handleCloseSearchedAudio = () => {
    setSearchedAudios([]);
    setOpenSearchList(false);
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
              className={`main_shadow h-8 w-0 p-0 border-0 delay-200 duration-500 `}
              type="text"
              required
              placeholder="Search"
            />
            <Button variant={"stylized"} className=" flex-none" size="icon">
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

      {openSearchList && (
        <Card className="w-full max-w-5xl max-h-screen fixed center-in-screen z-20 ">
          <CardHeader>
            <CardTitle>Searched Audios</CardTitle>
            <CardDescription>
              A curated list of audios based on your search input.
            </CardDescription>
          </CardHeader>
          <CardContent
            className={`grid md:grid-cols-2 xl:grid-cols-3 max-h-96 overflow-auto gap-2 `}
          >
            {/* All searched audios */}
            {/* Check if searchedAudios is an array and has elements */}
            {Array.isArray(searchedAudios) && searchedAudios.length > 0 ? (
              searchedAudios.map((audio, index) => (
                <div
                  key={index}
                  className={` w-full h-16 ${styles.flexCenter} pr-3 sm:gap-4 gap-2 rounded-full AudioCard`}
                >
                  {/* disk */}
                  <div
                    className={` ${
                      audioConfig[current]?.URL === audio.URL && playing
                        ? "discRotation"
                        : "discRotation animation-state-pause"
                    }  h-full aspect-square rounded-full bg-primary-black overflow-hidden flex-0 shadow-lg ${
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
                        src={audio ? audio.thumbnails[0] : ""}
                        alt="audio_thumbnails"
                      />
                    </div>
                  </div>

                  {/* Audio info */}
                  <div
                    className={`${styles.flexCenter} flex-col gap-1 text-center flex-1 overflow-hidden`}
                  >
                    <Link
                      href={audio?.owner?.canonicalURL || ""}
                      target="_"
                      title={audio?.owner?.name || ""}
                      className={` ${styles.XXsmall} text-muted-foreground ellipsis-on-1line  `}
                    >
                      {audio?.owner?.name || "Unavailable!"}
                    </Link>
                    <p
                      title={audio?.title || ""}
                      className={` ${styles.XXsmall} font-semibold text-primary cursor-default ellipsis-on-1line`}
                    >
                      {audio?.title || "Search below"}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className={`${styles.flexStart}  gap-2`}>
                    <Button
                      variant={"stylized"}
                      onClick={() => {
                        dispatch(ADD_ITEM(audio));

                        toast("Audio add to player successfully", {});
                      }}
                      size="icon"
                    >
                      <span className={` icon_clothes`}>
                        <PlayIcon className="h-3 w-3" />
                      </span>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className={`${styles.small} text-muted-foreground `}>
                No audios found. Please try searching again.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex justify-between mt-2">
            <Button
              onClick={() => handleCloseSearchedAudio()}
              variant="outline"
              className=" w-full"
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      )}
      <Toaster />
    </section>
  );
};

export default Hero;
