"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

// styles
import styles from "../styles/index";

// components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// auth
import { useAuth } from "@/context/AuthContext";

// constant
import { headerLinks, footerLinks } from "@/constants/index";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { selectMenuToggle, setMenuToggle } from "../store/UIConfig";
import { useDispatch, useSelector } from "react-redux";

const Header = () => {
  const pathname = usePathname();
  // call redux states
  const menuToggle = useSelector(selectMenuToggle);
  const dispatch = useDispatch();

  // auth
  const { user, logout } = useAuth();

  return (
    <header
      className={` ${pathname === "/" ? " fixed top-0" : " relative"}  ${
        styles.flexBetween
      } flex-col z-30 w-full border-b border-primary bg-primary text-secondary`}
    >
      <div
        className={` w-full ${styles.Xsmall} text-center bg-card text-card-foreground py-1`}
      >
        Engineered with love by{" "}
        <Link target="_" href={"https://elattar.dev"}>
          {" "}
          Elattar Ayoub
        </Link>{" "}
        &lt;3
      </div>

      <nav
        className={`relative ${styles.flexBetween} flex-wrap w-full py-4 ${styles.xPaddings} `}
      >
        <Link href={"/"} className={` w-20 md:w-28 lg:w-32 `}>
          <Image
            className={`object-contain w-full h-full `}
            width={24}
            height={24}
            src={"/svgs/logo.svg"}
            alt={"logo"}
          ></Image>
        </Link>

        {!user.ID && (
          <li
            className={` ${styles.flexStart} gap-6 ${styles.small} font-medium `}
          >
            {headerLinks.slice(1, 2).map((link, index) => (
              <Link key={index} href={link.url} data-value={link.name}>
                {link.name}
              </Link>
            ))}
          </li>
        )}

        {user.ID && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar>
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.userName.slice(0.2)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel> My Account </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href={`/profile/${user.ID}`}>
                <DropdownMenuItem>Profile</DropdownMenuItem>
              </Link>{" "}
              <Link href={`/profile/${user.ID}/collections`}>
                <DropdownMenuItem>Collections</DropdownMenuItem>
              </Link>{" "}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout()}
                className="bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
