import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

// Icon
import {
  HeartFilledIcon,
  HeartIcon,
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
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AddCollectionForm } from "@/components/forms/addCollection";

// constants
import { Owner, Audio, User } from "@/constants/interfaces";

// auth
import { useAuth } from "@/context/AuthContext";

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
  // auth
  const { user, dislikeAudio, likeAudio } = useAuth();

  // redux
  const audioConfig = useSelector(selectAudioConfig);
  const current = useSelector(selectCurrentAudio);
  const playing = useSelector(selectAudioPlaying);
  const AudioLoading = useSelector(selectAudioLoading);
  const volume = useSelector(selectAudioVolume);
  const dispatch = useDispatch();

  const handleDelete = (audio: Audio, index: number) => {
    dispatch(DELETE_ITEM(audio.ID));

    if (current > index) {
      console.log("current > index");
      dispatch(SKIP_PREV(1));
      return;
    }

    if (
      audio.ID === audioConfig[current].ID &&
      audioConfig.length - 1 === index
    ) {
      console.log("audio.ID === audioConfig[current].ID - mmm");

      dispatch(SKIP_PREV(1));
      return;
    }

    if (audio.ID === audioConfig[current].ID && index === 0) {
      console.log("audio.ID === audioConfig[current].ID && index === 0");

      dispatch(SKIP_NEXT(0));
      return;
    }
  };

  const handlePlayPause = () => {
    dispatch(SET_PLAYING(!playing));
  };

  const handleLikeAudio = async (audio: Audio) => {
    try {
      await likeAudio(audio);
      toast("Add to favorite audios successfully", {
        action: {
          label: "Undo",
          onClick: () => {
            handleDislikeAudio(audio);
          },
        },
      });

      return;
    } catch (err) {
      const errorMessage = (err as Error).message; // Assert err as Error to access message
      toast("We had an error!", {
        description: errorMessage,
      });
    }
  };

  const handleDislikeAudio = async (audio: Audio) => {
    const Audio_small = {
      ID: audio.ID,
      title: audio.title,
      thumbnails: [audio.thumbnails[0]],
    };

    if (user.lovedSongs.some((lovedSong: any) => lovedSong.ID === audio.ID)) {
      try {
        await dislikeAudio(Audio_small);
        toast("Removed from favorite audios successfully", {
          action: {
            label: "Undo",
            onClick: () => {
              handleLikeAudio(audio);
            },
          },
        });

        return;
      } catch (err) {
        const errorMessage = (err as Error).message; // Assert err as Error to access message
        toast("We had an error!", {
          description: errorMessage,
        });
      }
    }
  };

  const handleInteractionWithLike = async (audio: Audio) => {
    if (user.lovedSongs.some((lovedSong: any) => lovedSong.ID === audio.ID)) {
      await handleDislikeAudio(audio);
      return;
    }

    await handleLikeAudio(audio);
  };

  return (
    <Drawer>
      <Toaster />

      <DrawerTrigger asChild>
        <Button variant={"stylized"} size="icon">
          <span className={` icon_clothes`}>
            <ListBulletIcon className="h-3 w-3 " />
          </span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <div className={`${styles.flexBetween} gap-2`}>
              <div className={`${styles.flexStart} gap-2 flex-col`}>
                <DrawerTitle>Audio Drawer</DrawerTitle>
                <DrawerDescription>
                  Manage your audio list here.
                </DrawerDescription>
              </div>

              <AddCollectionForm audios={audioConfig} />
            </div>
          </DrawerHeader>
          <div className="p-4 pb-0 max-h-64 overflow-auto">
            {/* Audio list */}
            <div className={`${styles.flexStart} flex-col h-full gap-2  `}>
              {/* All audios */}
              {audioConfig[current] &&
                audioConfig.map((audio: Audio, index: number) => (
                  <div
                    key={index}
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
                        className={` ${styles.XXsmall} text-muted-foreground ellipsis-on-1line `}
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
                        variant={"stylized"}
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
                        variant={"stylized"}
                        onClick={() => handleDelete(audio, index)}
                        size="icon"
                      >
                        <span className={` icon_clothes`}>
                          <TrashIcon className="h-3 w-3 " />
                        </span>
                      </Button>

                      {user.ID && (
                        <Button
                          variant={"stylized"}
                          onClick={() => handleInteractionWithLike(audio)}
                          size="icon"
                        >
                          <span className={` icon_clothes`}>
                            {!user.lovedSongs.some(
                              (lovedSong: any) => lovedSong.ID === audio.ID
                            ) ? (
                              <HeartIcon className="h-3 w-3 " />
                            ) : (
                              <HeartFilledIcon className="h-3 w-3 " />
                            )}
                          </span>
                        </Button>
                      )}
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
