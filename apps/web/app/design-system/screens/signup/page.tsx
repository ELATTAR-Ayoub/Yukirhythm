"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EnvelopeOpenIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import { AuroraBackground } from "@/components/ui/aurora-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

const BASE = "/design-system/screens";

export default function SignupScreen() {
  const { signIn } = useMockStudio();
  const [emailOpen, setEmailOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const social = (provider: string) => {
    signIn();
    toast(`Account created with ${provider}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn();
    toast("Account created");
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <AuroraBackground className="!w-full !h-[72vh] p-6">
        <div className="relative w-full sm:max-w-[400px] flex flex-col items-center gap-4">
          <Image
            src="/svgs/logo_light.svg"
            width={24}
            height={24}
            alt="Yukirhythm"
            className="h-6 w-auto object-contain"
          />
          <h1 className="type-h2 text-center anim-sign-on">
            Join YukiRhythm
          </h1>

          <div className="w-full flex flex-col sm:flex-row gap-2">
            <Button className="w-full" onClick={() => social("Google")}>
              <Image
                src="/svgs/google.svg"
                width={16}
                height={16}
                alt=""
                className="mr-2 h-4 w-4"
              />
              Sign up with Google
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => social("GitHub")}
            >
              <Image
                src="/svgs/github.svg"
                width={16}
                height={16}
                alt=""
                className="mr-2 h-4 w-4"
              />
              Sign up with GitHub
            </Button>
          </div>

          <div className="w-full h-px bg-border" />

          {!emailOpen ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEmailOpen(true)}
            >
              <EnvelopeOpenIcon className="mr-2 h-4 w-4" /> Sign up with Email
            </Button>
          ) : (
            <form onSubmit={onSubmit} className="w-full space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  required
                  placeholder="yuki"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="yuki@contact.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="our small secret"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Create account
              </Button>
            </form>
          )}

          <p className="type-small">
            Already have an account?{" "}
            <Link href={`${BASE}/login`} className="underline">
              log in
            </Link>
            .
          </p>
        </div>
      </AuroraBackground>
    </div>
  );
}
