"use client";

import React from "react";

// styles
import styles from "@/styles";

// components
import { LoginForm } from "@/components/forms/login";
import { AuroraBackground } from "@/components/ui/aurora-background";

export default function Page() {
  return (
    <section
      className={`  relative ${styles.flexCenter} flex-col gap-4 w-full h-screen p-4 `}
    >
      <AuroraBackground className="p-4 ">
        <LoginForm />
      </AuroraBackground>
    </section>
  );
}
