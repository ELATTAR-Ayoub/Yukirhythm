import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

// styles
import styles from "@/styles/index";
import "@/styles/player.css";

// constants
import { Audio, User } from "@/constants/interfaces";

// components
import { Button } from "@/components/ui/button";
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

// player store
import { usePlayerStore } from "@/store/player";
import {
  HeartFilledIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
} from "@radix-ui/react-icons";
import { useAuth } from "@/context/AuthContext";

export function UserAudioList({ id }: { id: string }) {
  // auth
  const { user, getProfileUser, dislikeAudio, likeAudio } = useAuth();

  // player store
  const audioConfig = usePlayerStore((s) => s.audioState);
  const current = usePlayerStore((s) => s.currentAudio);
  const playing = usePlayerStore((s) => s.audioPlaying);
  const addItem = usePlayerStore((s) => s.addItem);
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
  const [, setLoading] = useState(true);

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
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body?.message || "Search failed");
          return body as Audio[];
        })
        .then((data) => {
          const item = data[0];
          if (item) {
            const already = audioConfig.some((a: Audio) => a.ID === item.ID);
            addItem(item);
            toast(already ? "Already in your player" : "Added to player");
          }
          setLoading(false);
        })
        .catch((error) => {
          setLoading(false);
          toast((error as Error).message || "Could not load this track");
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
              <div className={`${styles.flexStart} flex-row-reverse gap-2`}>
                <Button
                  variant={"secondary"}
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
                      <Button variant={"secondary"} size={"icon"}>
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
