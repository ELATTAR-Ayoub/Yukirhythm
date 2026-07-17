"use client";

// styles
import styles from "@/styles";

// components
import { SignupForm } from "@/components/forms/signup";
import { AuroraBackground } from "@/components/ui/aurora-background";

export default function Page() {
  return (
    <section
      className={`  relative ${styles.flexCenter} flex-col gap-4 w-full h-screen `}
    >
      <AuroraBackground className=" p-4">
        <SignupForm />
      </AuroraBackground>
    </section>
  );
}
