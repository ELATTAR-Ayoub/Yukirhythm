import React, { useState, useEffect } from "react";
import Image from "next/image";

// form
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// components
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// auth
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles";
import {
  EnvelopeOpenIcon,
  FaceIcon,
  GitHubLogoIcon,
} from "@radix-ui/react-icons";
import Loader from "../Loader";
import { Collection, Audio } from "@/constants/interfaces";

const formSchema = z.object({
  title: z
    .string()
    .min(10, { message: "Title must be at least 10 characters." }),
  description: z
    .string()
    .min(20, { message: "Description must be at least 20 characters." })
    .max(200, { message: "Description must be lower than 200 characters." }),
  tags: z
    .string()
    .min(5, { message: "Tags must be at least 5 characters." })
    .max(50, { message: "Tags must be lower than 50 characters." }),
});

export function AddCollectionForm({ audios }: { audios: Audio[] }) {
  const { user, addCollection } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "My cool collection",
      tags: "Rock, Jazz, Anime",
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    var collectionLengthSecTotal = 0;
    var thumbnailsArr: string[] = [];

    audios.forEach((audio) => {
      if (audio.audioLengthSec) {
        collectionLengthSecTotal += audio.audioLengthSec;
      }
      if (audio.thumbnails) {
        thumbnailsArr.push(audio.thumbnails[0]);
      }
    });

    const collectionData: Collection = {
      ID: "",
      title: values.title,
      desc: values.description,
      thumbnails: thumbnailsArr,
      owner: {
        ID: user.ID,
        docID: user.docID,
        name: user.userName,
        avatar: user.avatar,
      },
      audio: audios,
      likes: 0,
      tags: values.tags.split(",").map((tag) => tag.trim()), // Ensure correct formatting
      date: new Date().toISOString(),
      private: false,
      collectionLengthSec: collectionLengthSecTotal,
    };

    setLoading(true);
    try {
      if (audios.length !== 0) {
        await addCollection(collectionData);
        setLoading(false);
        // Optionally handle success, e.g., redirect
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      setErr(true);
      setErrMsg(errorMessage);
      setLoading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={audios.length === 0}>Make collection</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make Your Own Collection</DialogTitle>
          <DialogDescription>
            You can find your made collections under your profile page.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 w-full overflow-hidden"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="My cool collection"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This is your collection's public display title.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="The best collection for anime openings."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your collection's public description.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Rock, Jazz, Anime, etc..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your collection's public tags.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("tags") && (
              <div className={`${styles.flexStart} flex-wrap gap-1`}>
                {form
                  .watch("tags")
                  .split(",")
                  .map((tg, index) => (
                    <Badge key={index} variant="secondary">
                      {tg.trim()}
                    </Badge>
                  ))}
              </div>
            )}

            <DialogFooter className="sm:justify-start gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        </Form>

        {err && <p className={`${styles.small} text-destructive`}>{errMsg}</p>}
        {loading && <Loader />}
      </DialogContent>
    </Dialog>
  );
}
