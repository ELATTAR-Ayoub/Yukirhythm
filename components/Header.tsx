"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

// styles
import styles from "../styles/index";

// components
import Logo from "./Logo";
import SolidSvg from "./SolidSVG";

// constant
import { headerLinks, footerLinks } from "@/constants/index";

import { selectMenuToggle, setMenuToggle } from "../store/UIConfig";
import { useDispatch, useSelector } from "react-redux";

const Header = () => {
  const pathname = usePathname();
  // call redux states
  const menuToggle = useSelector(selectMenuToggle);
  const dispatch = useDispatch();

  return (
    <header
      className={` fixed top-0 ${styles.flexBetween} flex-col z-30 w-full border-b border-primary bg-primary text-secondary`}
    >
      <div
        className={` w-full ${styles.Xsmall} text-center bg-card text-card-foreground py-1`}
      >
        Engineered with love by{" "}
        <Link target="_" href={"https://github.com/ELATTAR-Ayoub"}>
          {" "}
          Elattar Ayoub
        </Link>{" "}
        &lt;3
      </div>

      <nav
        className={`relative ${styles.flexBetween} flex-wrap w-full py-4 ${styles.xPaddings} `}
      >
        <li
          className={` ${styles.flexStart} gap-6 ${styles.small} font-medium  `}
        >
          {headerLinks.slice(0, 1).map((link, index) => (
            <Link key={index} href={link.url} data-value={link.name}>
              {link.name}
            </Link>
          ))}
        </li>

        <Link href={"/"} className={` w-20 md:w-28 lg:w-32 center-in-parent`}>
          <Image
            className={`object-contain w-full h-full `}
            width={24}
            height={24}
            src={"/svgs/logo.svg"}
            alt={"logo"}
          ></Image>
        </Link>

        <li
          className={` ${styles.flexStart} gap-6 ${styles.small} font-medium `}
        >
          {headerLinks.slice(1, 2).map((link, index) => (
            <Link key={index} href={link.url} data-value={link.name}>
              {link.name}
            </Link>
          ))}
        </li>
      </nav>

      {/* <div
        className={` w-full bg-primary ${styles.Xsmall} text-center text-secondary py-1`}
      >
        © {new Date().getFullYear()} Yukirhythm.
      </div> */}
    </header>
  );
};

export default Header;
