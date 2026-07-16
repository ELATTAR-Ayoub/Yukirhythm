"use client";

// Sections
import { Hero } from "@/sections";

// styles
import styles from "@/styles/index";

const Page = () => {
  return (
    <div className={`  relative ${styles.flexStart} w-full h-full `}>
      <Hero />
    </div>
  );
};

export default Page;
