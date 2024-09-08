// 'use client'

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

// styles
import styles from "../styles/index";

// components
import SolidSvg from "./SolidSVG";

const sections = [
  {
    name: "home",
    url: "/home",
  },
  {
    name: "work",
    url: "/home#work",
  },
  {
    name: "about",
    url: "/home#about",
  },
  {
    name: "contact",
    url: "/home#contact",
  },
  {
    name: "hero",
    url: "/",
  },
];

// redux
import { selectMenuToggle, setMenuToggle } from "../store/UIConfig";
import { useDispatch, useSelector } from "react-redux";

const Menu = () => {
  const pathname = usePathname();
  // call redux states
  const menuToggle = useSelector(selectMenuToggle);
  const dispatch = useDispatch();

  function scrollToSection(href: string) {
    const contactSection = document.getElementById(href);

    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
      dispatch(setMenuToggle(false));
    }
  }

  return (
    <aside
      className={`fixed left-4 bottom-4 gap-24 h-auto w-20 sideBar ${
        styles.flexCenter
      } flex-col bg-primary-white text-primary-black ${
        menuToggle ? " " : "-translate-x-[150%]"
      } overflow-hidden z-[25] transition-all duration-500`}
    >
      <nav
        className={` ${styles.flexStart} flex-col gap-[2px] relative w-full p-2`}
      >
        {sections.map((link, index) => (
          <Link
            key={index}
            href={link.url}
            onClick={() => {
              scrollToSection(link.name);
            }}
            data-value={link.name}
            className={` ${styles.flexCenter} p-1 py-0 no-underline text-base sm:text-lg lg:text-base uppercase hover:text-primary-white hover:bg-primary-black transition-all duration-300`}
          >
            {link.name}
          </Link>
        ))}
      </nav>

      <button
        title="Close menu"
        onClick={() => {
          dispatch(setMenuToggle(false));
        }}
        className={`${styles.flexCenter} p-1 py-2 hover:bg-primary-black w-full transition-all duration-300 close`}
      >
        <SolidSvg
          className={`closeSVG w-6 aspect-square transition-all duration-300`}
          color={"#0D0D0D"}
          src={"/svgs/arrow-left.svg"}
          width={14}
          height={14}
        ></SolidSvg>
      </button>
    </aside>
  );
};

export default Menu;
