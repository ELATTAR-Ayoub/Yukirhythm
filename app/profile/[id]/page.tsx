"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

// Sections
import { Hero } from "@/sections";

// styles
import styles from "@/styles/index";

// auth
import { useAuth } from "@/context/AuthContext";

// components
import Logo from "@/components/Logo";
import SolidSvg from "@/components/SolidSVG";
import { UserAudioList } from "@/components/player/UserAudioList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCollectionList } from "@/components/player/UserCollectionsList";

// redux
import { selectMenuToggle, setMenuToggle } from "@/store/UIConfig";
import { useDispatch, useSelector } from "react-redux";
import { User } from "@/constants/interfaces";

const Page = ({ params }: any) => {
  // auth
  const { user, logout, getProfileUser } = useAuth();

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

  // call redux states
  const menuToggle = useSelector(selectMenuToggle);
  const dispatch = useDispatch();

  // values
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getProfileUser(params.id);
      setProfileUser(data);
    };
    fetchData();
    setLoading(false);
  }, [params.id]);

  return (
    <section
      className={`  relative ${styles.flexStart} w-full h-screen ${styles.paddings} `}
    >
      <Tabs defaultValue="audio" className="w-full h-full">
        <div
          className={`${styles.flexBetween} gap-2 w-ful flex-col-reverse sm:flex-row  `}
        >
          <TabsList className="grid grid-cols-2 w-full sm:w-auto sm:max-w-xs ">
            <TabsTrigger value="audio">Favorite Audio</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
          </TabsList>

          <div className={`relative ${styles.flexCenter} gap-2`}>
            <Avatar className=" border ">
              <AvatarImage src={profileUser.avatar} />
              <AvatarFallback>{profileUser.userName.slice(0.2)}</AvatarFallback>
            </Avatar>

            <div className={`relative ${styles.flexStart} flex-col w-full `}>
              <p className={`${styles.small} font-semibold `}>
                {profileUser.userName}{" "}
              </p>
              <p
                className={`${styles.Xsmall} font-light text-muted-foreground `}
              >
                {profileUser.email}
              </p>
            </div>
          </div>
        </div>

        <TabsContent value="audio">
          <Card>
            <CardHeader>
              <CardTitle>Favorite Audio</CardTitle>
              <CardDescription>
                This card showcases the track that you loved so far.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <UserAudioList id={params.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections">
          <Card>
            <CardHeader>
              <CardTitle>Collections</CardTitle>
              <CardDescription>
                This card showcases the collections that you made so far.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <UserCollectionList id={params.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default Page;
