import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

// styles
import styles from "@/styles/index";
import "@/styles/player.css";

// constants
import { Owner, Audio, User } from "@/constants/interfaces";

// components
import SolidSvg from "@/components/SolidSVG";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// redux
import {
  selectAudioConfig,
  selectCurrentAudio,
  selectAudioPlaying,
  SET_PLAYING,
  SET_CURRENT,
  DELETE_ITEM,
  ADD_ITEM,
} from "@/store/AudioConfig";
import { useDispatch, useSelector } from "react-redux";
import {
  HeartFilledIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useAuth } from "@/context/AuthContext";

export function UserAudioList({ id }: { id: string }) {
  // auth
  const { user, getProfileUser, dislikeAudio, likeAudio } = useAuth();

  // redux
  const current = useSelector(selectCurrentAudio);
  const playing = useSelector(selectAudioPlaying);
  const dispatch = useDispatch();
  const router = useRouter();

  //   profileUser
  const [profileUser, setProfileUser] = useState<User>({
    ID: "",
    docID: "",
    avatar: "",
    userName: "",
    email: "",
    marketingEmails: false,
    lovedSongs: [],
    collections: [],
    lovedCollections: [],
    followers: [],
    following: [],
  });

  // values
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getProfileUser(id);
      setProfileUser(data);
    };
    fetchData();
    setLoading(false);
  }, [id]);

  const searchAudio = (inputValue: string) => {
    setLoading(true);
    //
    if (inputValue) {
      fetch("/api/searchEngine", {
        method: "POST",
        body: JSON.stringify({
          string: `${inputValue}`,
          quantity: 1,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data: Audio[]) => {
          dispatch(ADD_ITEM(data[0]));
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    }
    //
  };

  const fetchData = async () => {
    setLoading(true);
    const data = await getProfileUser(id);
    setProfileUser(data);
    setLoading(false);
  };

  const handlePlayPause = (audio: Audio) => {
    const query = audio.title + " " + (audio.owner?.name || "");
    searchAudio(query);
    router.push(`/`);
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
    if (user.lovedSongs.some((lovedSong: any) => lovedSong.ID === audio.ID)) {
      try {
        await dislikeAudio(audio);
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
      fetchData();
      return;
    }

    await handleLikeAudio(audio);
    fetchData();
  };

  return (
    <>
      <Toaster />
      {/* Audio list */}
      <div
        className={`grid md:grid-cols-2 xl:grid-cols-3 w-full h-full gap-2 overflow-auto `}
      >
        {/* All audios */}
        {profileUser.lovedSongs &&
          profileUser.lovedSongs.map((audio, index) => (
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
                    handlePlayPause(audio);
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
                {user.ID == profileUser.ID && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant={"stylized"} size={"icon"}>
                        {!user.lovedSongs.some(
                          (lovedSong: any) => lovedSong.ID === audio.ID
                        ) ? (
                          <HeartIcon className="h-3 w-3 " />
                        ) : (
                          <HeartFilledIcon className="h-3 w-3 " />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove this audio from your favorites.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleInteractionWithLike(audio)}
                        >
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
