import React, { useState, useEffect } from "react";
import Image from "next/image";

// form
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// components
import Loader from "../Loader";
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

// auth
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles";
import {
  EnvelopeOpenIcon,
  FaceIcon,
  GitHubLogoIcon,
} from "@radix-ui/react-icons";
import router from "next/router";
import Link from "next/link";

const formSchema = z.object({
  username: z.string().min(3, {
    message: "Username must be at least 3 characters.",
  }),
  email: z.string().min(10, {
    message: "Email must be at least 10 characters.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
});

export function SignupForm() {
  const { user, signup, signupPopup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [emailLogin, setEmailLogin] = useState(false);
  const [userAvatar, setUserAvatar] = useState(
    `https://api.dicebear.com/5.x/lorelei/svg?seed=`
  );
  // ...

  // inputs

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    setUserAvatar(setUserAvatar + values.username);
    setLoading(true);
    try {
      await signup(values.email, values.password, userAvatar, values.username);
      setLoading(false);
      // router.push(`/`);
    } catch (err) {
      const errorMessage = (err as Error).message; // Assert err as Error to access message
      setErr(true);
      setErrMsg(errorMessage);
      setLoading(false);
    }
  }

  const signupGoogleFunc = async () => {
    try {
      setLoading(true);
      await signupPopup("google");
    } catch (err) {
      console.log(err);
      const errorMessage = (err as Error).message; // Assert err as Error to access message
      setErr(true);
      setErrMsg(errorMessage);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const signupFacebookFunc = async () => {
    setLoading(true);

    try {
      await signupPopup("facebook");
    } catch (err) {
      console.log(err);
      const errorMessage = (err as Error).message; // Assert err as Error to access message
      setErr(true);
      setErrMsg(errorMessage);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`  relative ${styles.flexStart} w-full flex-col max-w-[400px] space-y-4`}
    >
      {/* quick form */}
      <div
        className={`relative ${styles.flexCenter} flex-col space-y-4 w-full   `}
      >
        {/* logo */}

        <div className={`h-6 `}>
          <Image
            className={`object-contain w-full h-full`}
            width={24}
            height={24}
            src={"/svgs/logo_light.svg"}
            alt={"disc"}
          ></Image>
        </div>

        <h1 className={` w-full ${styles.H2} font-semibold text-center `}>
          Welcome to YukiRhythem
        </h1>

        {/* google and facebook signup-in */}
        <div
          className={` w-full ${styles.flexCenter} sm:flex-row flex-col gap-2 `}
        >
          <Button onClick={signupGoogleFunc} className={`w-full`}>
            {" "}
            <Image
              className="mr-2 h-4 w-4"
              width={24}
              height={24}
              src={"/svgs/google.svg"}
              alt={"disc"}
            ></Image>
            Signup with Google
          </Button>
          <Button onClick={signupFacebookFunc} className={`w-full`} disabled>
            <Image
              className="mr-2 h-4 w-4"
              width={24}
              height={24}
              src={"/svgs/facebook.svg"}
              alt={"disc"}
            ></Image>
            Signup with Facebook
          </Button>
        </div>

        {/* break line */}
        <div className="w-full h-[1px] bg-secondary"></div>

        {/* open email login */}
        {!emailLogin && (
          <Button
            onClick={() => setEmailLogin(true)}
            variant="outline"
            className={`w-full`}
          >
            <EnvelopeOpenIcon className="mr-2 h-4 w-4" /> Signup with Email
          </Button>
        )}
      </div>

      {/* email form */}

      <div
        className={`  relative ${styles.flexCenter} w-full ${
          emailLogin ? "h-auto" : "h-0 overflow-hidden"
        }   transition-all duration-500 `}
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 w-full"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="username"
                      placeholder="Chad Nickle"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This is your public display name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Yuki@contact.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your email adress for communication and notifications.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="current-password"
                      type="password"
                      placeholder="a small secret"
                      {...field}
                    />
                  </FormControl>
                  {/* <FormDescription>Your password.</FormDescription> */}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">Submit</Button>
            <p className={` ${styles.small}`}>
              Already have an account?{" "}
              <Link className=" underline" href={"/login"}>
                login
              </Link>
              .
            </p>
          </form>
        </Form>
      </div>

      {err && <p className={` ${styles.small} text-destructive`}>{errMsg}</p>}

      {/* loading */}
      {loading ? <Loader /> : <></>}
    </div>
  );
}
