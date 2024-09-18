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
import { socialLinks } from "@/constants/index";

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
      className={` relative  w-full bg-primary  border-t-0 border border-primary-white  px-4 py-12 md:px-12`}
    ></footer>
  );
};

export default Footer;
