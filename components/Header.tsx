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

// redux
import { selectMenuToggle, setMenuToggle } from "../store/UIConfig";
import { useDispatch, useSelector } from "react-redux";

const Header = () => {
  const pathname = usePathname();
  // call redux states
  const menuToggle = useSelector(selectMenuToggle);
  const dispatch = useDispatch();

  return (
    <header
      className={` fixed top-0 left-0 ${
        styles.flexBetween
      } z-30 w-full h-auto md:h-14 overflow-hidden border-y ${
        pathname != "/ex"
          ? ` bg-primary-black text-secondary-white border-secondary-white`
          : ` bg-secondary-white  border-primary-black text-primary-black`
      }  py-2 px-4 md:py-3 md:px-6 `}
    >
      <Logo mode={`${pathname != "/ex" ? `light` : `dark`}`} />

      <div
        className={` center-in-parent border ${
          pathname != "/ex"
            ? ` border-secondary-white`
            : ` border-primary-black bg-secondary-white`
        } rounded-full w-72 max-w-[18rem] p-2 ${
          styles.flexStart
        } overflow-hidden hidden sm:flex`}
      >
        <div className={`w-full flex flex-nowrap gap-2 loop_f_l_t_r`}>
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className={`w-72 ${styles.flexCenter} flex-nowrap whitespace-nowrap gap-2`}
            >
              <p className="text-lg">
                Available for Full-Time work and freelance
              </p>
              <div className="bg-accent-color h-2 w-2 rotate-45"></div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          dispatch(setMenuToggle(!menuToggle));
        }}
        data-value={menuToggle ? "Close" : "Menu"}
        className={` text-base md:text-lg`}
      >
        {menuToggle ? "Close" : "Menu"}
      </button>
    </header>
  );
};

export default Header;
