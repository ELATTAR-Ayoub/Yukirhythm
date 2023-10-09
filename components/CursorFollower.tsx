"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

// styles
import "@/styles/cursor.css";
import styles from "../styles/index";

// Components
import SolidSvg from "./SolidSVG";

// Redux
import { selectLoading, setLoading } from "../store/UIConfig";
import { useDispatch, useSelector } from "react-redux";

const Loader = () => {
  const pathname = usePathname();

  // call redux states
  const loading = useSelector(selectLoading);
  const dispatch = useDispatch();

  useEffect(() => {
    const fake_cursor = document.getElementById("fake-cursor");
    const fake_cursor2 = document.getElementById("fake-cursor2");
    const fake_cursor3 = document.getElementById("fake-cursor3");

    window.onpointermove = (event) => {
      const { clientX, clientY } = event;

      fake_cursor!.animate(
        {
          left: `${clientX}px`,
          top: `${clientY}px`,
        },
        { duration: 0, fill: "forwards" }
      );

      fake_cursor3!.animate(
        {
          left: `${clientX}px`,
          top: `${clientY}px`,
        },
        { duration: 0, fill: "forwards" }
      );

      fake_cursor2!.animate(
        {
          left: `${clientX}px`,
          top: `${clientY}px`,
        },
        { duration: 2000, fill: "forwards" }
      );
    };
  }, []);

  return (
    <>
      <div id="fake-cursor">
        {" "}
        <SolidSvg
          width={20}
          height={20}
          className={` ${
            loading ? " animate-spin" : ""
          } transition-all duration-300 fake-cursorSVG`}
          color={` ${pathname == "/ex" ? "#0D0D0D" : "#F0F0F0"}`}
          src={"/svgs/cursor_default.svg"}
        ></SolidSvg>{" "}
      </div>
      <div id="fake-cursor3">
        {" "}
        <SolidSvg
          width={20}
          height={20}
          className={` opacity-0 transition-all duration-300 fake-cursor3SVG`}
          color={` ${pathname == "/ex" ? "#0D0D0D" : "#F0F0F0"}`}
          src={"/svgs/cursor_default.svg"}
        ></SolidSvg>{" "}
      </div>
      <div id="fake-cursor2">
        {" "}
        <SolidSvg
          width={24}
          height={24}
          className={`transition-all duration-300 fake-cursor2SVG`}
          color={` ${pathname == "/ex" ? "#0D0D0D" : "#F0F0F0"}`}
          src={"/svgs/cursor_default2.svg"}
        ></SolidSvg>{" "}
      </div>
    </>
  );
};

export default Loader;
