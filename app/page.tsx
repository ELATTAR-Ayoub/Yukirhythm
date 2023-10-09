"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

// Sections
import { Hero } from "@/sections";

// styles
import styles from "@/styles/index";

// components
import Logo from "@/components/Logo";
import SolidSvg from "@/components/SolidSVG";

// redux
import { selectLoading, setLoading } from "@/store/UIConfig";
import { useDispatch, useSelector } from "react-redux";

// Gsap
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
// gsap.registerPlugin(ScrollTrigger);

const Page = () => {
  return (
    <div className={`  relative ${styles.flexStart} w-full h-full `}>
      <Hero />
    </div>
  );
};

export default Page;
