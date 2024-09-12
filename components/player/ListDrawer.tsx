import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

// Icon
import {
  ListBulletIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";

// styles
import styles from "@/styles/index";
import "@/styles/player.css";

// Components
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

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

const data = [
  {
    goal: 400,
  },
  {
    goal: 300,
  },
  {
    goal: 200,
  },
  {
    goal: 300,
  },
  {
    goal: 200,
  },
  {
    goal: 278,
  },
  {
    goal: 189,
  },
  {
    goal: 239,
  },
  {
    goal: 300,
  },
  {
    goal: 200,
  },
  {
    goal: 278,
  },
  {
    goal: 189,
  },
  {
    goal: 349,
  },
];

export function ListDrawer() {
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
    <Drawer>
      <DrawerTrigger asChild>
        <Button size="icon">
          <span className={` icon_clothes`}>
            <ListBulletIcon className="h-3 w-3 " />
          </span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Audio Drawer</DrawerTitle>
            <DrawerDescription>Manage your audio list here.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-0 max-h-64 overflow-auto">
            {/* Audio list */}
            <div className={`${styles.flexStart} flex-col h-full gap-2  `}>
              {/* All audios */}
              {audioConfig[current] &&
                audioConfig.map((audio, index) => (
                  <div
                    className={` w-full h-16 ${styles.flexCenter} pr-3 sm:gap-4 gap-2 rounded-full AudioCard`}
                  >
                    {/* disk */}
                    <div
                      className={` ${
                        current == index && playing
                          ? "discRotation"
                          : " discRotation animation-state-pause"
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
                          src={
                            audioConfig[index]
                              ? audioConfig[index].thumbnails[0]
                              : ""
                          }
                          alt="audio_thumbnails"
                        />
                      </div>
                    </div>

                    {/* Audio info */}
                    <div
                      className={`${styles.flexCenter} flex-col gap-1 text-center flex-1 overflow-hidden`}
                    >
                      <Link
                        href={audioConfig[index]?.owner?.canonicalURL || ""}
                        target="_"
                        title={audioConfig[index]?.owner?.name || ""}
                        className={` ${styles.XXsmall} text-primary ellipsis-on-1line `}
                      >
                        {audioConfig[index]?.owner?.name || "Welcome!"}
                      </Link>
                      <p
                        title={audioConfig[index]?.title || ""}
                        className={` ${styles.XXsmall} font-semibold text-primary cursor-default ellipsis-on-1line`}
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
                          {current == index && playing ? (
                            <PauseIcon className="h-3 w-3 " />
                          ) : (
                            <PlayIcon className="h-3 w-3" />
                          )}
                        </span>
                      </Button>
                      <Button
                        onClick={() => handleDelete(audio.ID)}
                        size="icon"
                      >
                        <span className={` icon_clothes`}>
                          <TrashIcon className="h-3 w-3 " />
                        </span>
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
