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

const Page = ({ params }: any) => {
  return (
    <section className={`  relative ${styles.flexStart} w-full h-full `}>
      {params.id}
    </section>
  );
};

export default Page;
