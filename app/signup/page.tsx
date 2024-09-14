"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

// styles
import styles from "@/styles";
import stylescss from "@/styles/page.module.css";

// components
import { SignupForm } from "@/components/forms/signup";
import { AuroraBackground } from "@/components/ui/aurora-background";

// route
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  EnvelopeOpenIcon,
  FaceIcon,
  GitHubLogoIcon,
} from "@radix-ui/react-icons";

export default function Page() {
  const router = useRouter();

  return (
    <section
      className={`  relative ${styles.flexCenter} flex-col gap-4 w-full h-screen p-4 `}
    >
      <AuroraBackground>
        <SignupForm />
      </AuroraBackground>
    </section>
  );
}
