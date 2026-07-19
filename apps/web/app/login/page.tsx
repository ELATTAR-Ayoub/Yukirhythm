"use client";

// styles
import styles from "@/styles";

// components
import { LoginForm } from "@/components/forms/login";
import { TextureBackground } from "@/components/ui/texture-background";

export default function Page() {
  return (
    <section
      className={`  relative ${styles.flexCenter} flex-col gap-4 w-full h-screen p-4 `}
    >
      <TextureBackground className="p-4 ">
        <LoginForm />
      </TextureBackground>
    </section>
  );
}
