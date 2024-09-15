"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

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
