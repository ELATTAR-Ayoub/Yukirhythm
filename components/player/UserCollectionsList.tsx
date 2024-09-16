import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

// styles
import styles from "@/styles/index";
import "@/styles/player.css";

// constants
import { Owner, Audio, User, Collection } from "@/constants/interfaces";

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
import { Badge } from "../ui/badge";

export function UserCollectionList({ id }: { id: string }) {
  // auth
  const {
    user,
    getProfileUser,
    dislikeCollection,
    likeCollection,
    getUserCollections,
  } = useAuth();

  // redux
  // const audioConfig = useSelector(selectAudioConfig);
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

  //   collection
  const [userCollections, setUserCollections] = useState<Collection[]>([]);

  // values
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPUser = async () => {
      setLoading(true);
      const data = await getProfileUser(id);
      setProfileUser(data);
    };
    fetchPUser();

    const fetchPCollections = async () => {
      setLoading(true);
      const data = await getUserCollections(id);
      setUserCollections(data);
      setLoading(false);
    };
    fetchPCollections();
  }, [id]);

  const searchAudio = (inputValue: string) => {
    fetch("/api/searchEngine", {
      method: "POST",
      body: JSON.stringify({ string: inputValue, quantity: 1 }),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data: Audio) => {
        dispatch(ADD_ITEM(data));
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const fetchData = async () => {
    setLoading(true);
    const data = await getProfileUser(id);
    setProfileUser(data);
    setLoading(false);
  };

  const handlePlayPause = (audios: Audio[]) => {
    audios.map((audio, index) => searchAudio(audio.ID));
    router.push(`/`);
  };

  const handleLikeCollection = async (collection: Collection) => {
    try {
      await likeCollection(collection);
      toast("Add to favorite collections successfully", {
        action: {
          label: "Undo",
          onClick: () => {
            handleDislikeCollection(collection);
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

  const handleDislikeCollection = async (collection: Collection) => {
    try {
      await dislikeCollection(collection);
      toast("Removed from favorite collections successfully", {
        action: {
          label: "Undo",
          onClick: () => {
            handleLikeCollection(collection);
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

  const handleInteractionWithLike = async (collection: Collection) => {
    if (user.lovedCollections.includes(collection.ID)) {
      await handleDislikeCollection(collection);
      fetchData();
      return;
    }

    await handleLikeCollection(collection);
    fetchData();
  };

  return (
    <>
      <Toaster />
      {/* Audio list */}
      <div
        className={`grid md:grid-cols-2 xl:grid-cols-3 w-full h-full gap-2 overflow-auto `}
      >
        {/* All collections */}
        {userCollections.map((collection, index) => (
          <div
            className={` w-full h-16 ${styles.flexCenter}  pr-3 sm:gap-4 gap-2 rounded-full AudioCard`}
          >
            {/* disk */}

            <div className={` h-full w-28  overflow-hidden `}>
              <div
                className={` h-full ${styles.flexCenter} gap-0 collectionDisks `}
              >
                {collection.thumbnails.map((thumbnail, index) => (
                  <div
                    className={`relative h-full aspect-square rounded-full bg-primary-black overflow-hidden flex-0 drop-shadow-on-disk ${styles.flexCenter}`}
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
                      className={`  Disk_img transition-all duration-700 h-full aspect-video z-[-1] pointer-events-none `}
                    >
                      <img
                        className={` w-full h-full object-cover relative `}
                        src={thumbnail ? thumbnail : ""}
                        alt="collection_thumbnails"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio info */}
            <div
              className={`${styles.flexCenter} flex-col gap-1 text-center flex-1 overflow-hidden`}
            >
              <Link
                href={`/profile/${collection.owner.ID}`}
                target="_"
                title={collection.owner.name || ""}
                className={` ${styles.XXsmall} text-muted-foreground ellipsis-on-1line  `}
              >
                {collection?.owner?.name || "Anonymous"}
              </Link>
              <p
                title={collection?.title || ""}
                className={` ${styles.XXsmall} font-semibold text-primary cursor-default ellipsis-on-1line`}
              >
                {collection.title || ""}
              </p>

              {/* {collection.tags && (
                <div className={`${styles.flexStart} flex-wrap gap-1`}>
                  {collection.tags.map((tg, index) => (
                    <Badge size={"sm"} key={index} variant="secondary">
                      {tg.trim()}
                    </Badge>
                  ))}
                </div>
              )} */}
            </div>

            {/* Controls */}
            <div className={`${styles.flexStart}  gap-2`}>
              <Button
                variant={"stylized"}
                onClick={() => {
                  handlePlayPause(collection.audio);
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
              {user.ID == profileUser.ID &&
                (user.lovedCollections.includes(collection.ID) ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant={"stylized"} size={"icon"}>
                        <HeartFilledIcon className="h-3 w-3 " />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove this collection from your favorites.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleInteractionWithLike(collection)}
                        >
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    onClick={() => handleInteractionWithLike(collection)}
                    variant={"stylized"}
                    size={"icon"}
                  >
                    <HeartIcon className="h-3 w-3 " />
                  </Button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
