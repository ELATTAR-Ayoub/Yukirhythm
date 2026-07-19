"use client";

// styles
import styles from "@/styles";

// components
import { SignupForm } from "@/components/forms/signup";
import { TextureBackground } from "@/components/ui/texture-background";

export default function Page() {
  return (
    <section
      className={`  relative ${styles.flexCenter} flex-col gap-4 w-full h-screen `}
    >
      <TextureBackground className=" p-4">
        <SignupForm />
      </TextureBackground>
    </section>
  );
}
