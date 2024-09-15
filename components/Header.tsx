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
import { DropdownMenuIcon, HamburgerMenuIcon } from "@radix-ui/react-icons";

const Header = () => {
  const pathname = usePathname();
  // call redux states
  const menuToggle = useSelector(selectMenuToggle);
  const dispatch = useDispatch();

  // auth
  const { user, logout } = useAuth();

  return (
    <header
      className={` fixed right-4 bottom-4 ${styles.flexBetween} flex-col z-30 w-full text-primary shadow-lg`}
    >
      <nav className={`relative ${styles.flexCenter} `}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            {!user.ID ? (
              <div
                className={`relative ${styles.flexCenter} w-10 sm:w-12 aspect-square bg-secondary/50 rounded-full p-1 `}
              >
                <HamburgerMenuIcon className="w-5 h-5 " />
              </div>
            ) : (
              <Avatar>
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.userName.slice(0.2)}</AvatarFallback>
              </Avatar>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel> Menu </DropdownMenuLabel>
            <Link href={`/`}>
              <DropdownMenuItem>Home</DropdownMenuItem>
            </Link>{" "}
            {!user.ID ? (
              <Link href={`/login`}>
                <DropdownMenuItem>Login</DropdownMenuItem>
              </Link>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel> My Account </DropdownMenuLabel>
                <Link href={`/profile/${user.ID}`}>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                </Link>{" "}
                <Link href={`/profile/${user.ID}/collections`}>
                  <DropdownMenuItem>Collections</DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="bg-destructive text-destructive-foreground shadow-sm hover:!bg-destructive/90"
                >
                  Log out
                </DropdownMenuItem>
              </>
            )}{" "}
          </DropdownMenuContent>
        </DropdownMenu>
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
