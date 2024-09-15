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
import Loader from "../Loader";

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

export function LoginForm() {
  const { user, signin, signinPopup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [emailLogin, setEmailLogin] = useState(false);
  const [userAvatar, setUserAvatar] = useState(
    "https://api.dicebear.com/5.x/lorelei/svg?seed=A"
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
    // ✅ This will be type-safe and validated.
    setLoading(true);
    try {
      await signin(values.email, values.password, userAvatar, values.username);
      setLoading(false);
      //   router.push(`/`);
    } catch (err) {
      console.log(err);
      setErr(true);

      setLoading(false);
    }
  }

  const signupGoogleFunc = async () => {
    try {
      setLoading(true);
      await signinPopup("google");
    } catch (err) {
      console.log(err);
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const signupFacebookFunc = async () => {
    setLoading(true);

    try {
      await signinPopup("facebook");
    } catch (err) {
      console.log(err);
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`  relative ${styles.flexStart} w-full flex-col sm:max-w-[400px] space-y-4`}
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
          Welcome back to YukiRhythem
        </h1>

        {/* google and facebook signup-in */}
        <div
          className={` w-full ${styles.flexCenter} sm:flex-row flex-col gap-2 `}
        >
          <Button
            onClick={signupGoogleFunc}
            variant="normal"
            className={`w-full`}
          >
            {" "}
            <Image
              className="mr-2 h-4 w-4"
              width={24}
              height={24}
              src={"/svgs/google.svg"}
              alt={"disc"}
            ></Image>
            Login with Google
          </Button>
          <Button
            onClick={signupFacebookFunc}
            variant="normal"
            className={`w-full`}
          >
            <Image
              className="mr-2 h-4 w-4"
              width={24}
              height={24}
              src={"/svgs/facebook.svg"}
              alt={"disc"}
            ></Image>
            Login with Facebook
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
            <EnvelopeOpenIcon className="mr-2 h-4 w-4" /> Login with Email
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="username"
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
                      placeholder="our small secret"
                      {...field}
                    />
                  </FormControl>
                  {/* <FormDescription>Your password.</FormDescription> */}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button variant={"normal"} type="submit">
              Submit
            </Button>

            <p className={` ${styles.small}`}>
              Don't have an account?{" "}
              <Link className=" underline" href={"/signup"}>
                sign up
              </Link>
              .
            </p>
          </form>
        </Form>
      </div>

      {err && (
        <p className={` ${styles.small} text-destructive`}>
          We had an issue signing you up, please try again.
        </p>
      )}

      {/* loading */}
      {loading ? <Loader /> : <></>}
    </div>
  );
}
