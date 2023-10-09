"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import Image from "next/image";

// styles
import styles from "../styles/index";
import "../styles/hero.css";

// components
import SolidSvg from "../components/SolidSVG";

const Hero = () => {
  return (
    <section
      className={` relative ${styles.flexCenter} w-full screen-height-with-header overflow-hidden bg-primary-black text-secondary-white `}
    >
      Have Fun Making Great Things!
    </section>
  );
};

export default Hero;
