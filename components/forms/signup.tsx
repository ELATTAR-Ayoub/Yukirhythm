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
  const [emailLogin, setEmailLogin] = useState(false);
  const [userAvatar, setUserAvatar] = useState(
    "https://api.dicebear.com/5.x/lorelei/svg?seed=A"
  );
  // ...

  // inputs

  //   const signupEmail = async (
  //     event:
  //       | React.MouseEvent<HTMLButtonElement>
  //       | React.FormEvent<HTMLFormElement>
  //   ) => {
  //     event.preventDefault();
  //     setLoading(true);

  //     try {
  //       await signup(
  //         email,
  //         password,
  //         userAvatar,
  //         name,
  //         marketingEmails,
  //         shareData
  //       );
  //       // router.push(`/profile/${user.uid}`)
  //       setLoading(false);
  //       // router.push(`/`)
  //     } catch (err) {
  //       console.log(err);
  //       setLoading(false);
  //     }
  //   };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values);
  }

  return (
    <div
      className={`  relative ${styles.flexStart} w-full flex-col sm:max-w-[400px]`}
    >
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
          <Button variant="normal" className={`w-full`}>
            {" "}
            <GitHubLogoIcon className="mr-2 h-4 w-4" />
            Login with Google
          </Button>
          <Button variant="normal" className={`w-full`}>
            <FaceIcon className="mr-2 h-4 w-4" />
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
                    <Input placeholder="shadcn" {...field} />
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
                    <Input type="email" placeholder="shadcn" {...field} />
                  </FormControl>
                  <FormDescription>This is your email.</FormDescription>
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
                    <Input type="password" placeholder="shadcn" {...field} />
                  </FormControl>
                  <FormDescription>This is your password.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button variant={"normal"} type="submit">
              Submit
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
