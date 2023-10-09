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
import { socials } from "@/constants/index";

const links = [
  {
    name: "elattarayoub000@gmail.com",
    url: "mailto:elattarayoub000@gmail.com",
  },
  {
    name: "PRIVACY POLICY",
    url: "",
  },
  {
    name: "DESIGNED AND DEVELOPED with <3 BY ELATTAR Ayoub.",
    url: "",
  },
];

// redux
import { selectLoading } from "../store/UIConfig";
import { useDispatch, useSelector } from "react-redux";

const Footer = () => {
  const pathname = usePathname();
  // call redux states
  const loading = useSelector(selectLoading);
  const dispatch = useDispatch();

  return (
    <footer
      className={` relative ${
        styles.flexBetween
      } flex-col-reverse lg:flex-row gap-12 md:gap-6 ${
        pathname != "/" ? ` flex` : ` hidden`
      } w-full bg-primary-black  border-t-0 border border-secondary-white  px-4 py-12 md:px-12`}
    >
      <div
        className={` grid grid-cols-2 grid-rows-2 h-full w-full lg:w-[400px] text-xs md:text-base`}
      >
        {links.map((link, index) => (
          <Link
            key={index}
            href={link.url}
            target={"_blank"}
            data-value={link.name}
            className={` ${
              index == 2 ? "col-span-2 border-b border-l" : "col-span-1"
            } ${
              index == 0 ? "border-l" : ""
            } p-4 py-2 border-r border-t border-secondary-white grid place-content-center  hacker-text uppercase`}
          >
            {" "}
            {link.name}{" "}
          </Link>
        ))}
      </div>

      <div
        className={` grid grid-cols-2 md:grid-cols-2 md:grid-rows-2 gap-6 w-full md:w-auto `}
      >
        {socials.map((social, index) => (
          <Link
            key={index}
            href={social.url}
            target={"_blank"}
            data-value={social.name}
            className={` ${styles.flexCenter} underline CTA-secondary p-2 px-4 uppercase !text-xs md:!text-base`}
          >
            {" "}
            {social.name}
          </Link>
        ))}
      </div>
    </footer>
  );
};

export default Footer;
