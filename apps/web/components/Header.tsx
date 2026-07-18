"use client";

import Link from "next/link";

// styles
import styles from "../styles/index";

// components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// auth
import { useAuth } from "@/context/AuthContext";

// constant
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { HamburgerMenuIcon } from "@radix-ui/react-icons";

const Header = () => {
  // auth
  const { user, logout } = useAuth();

  return (
    <header
      className={` fixed right-4 sm:left-1/2 sm:-translate-x-1/2 bottom-4 ${styles.flexCenterStart} z-30 text-primary `}
    >
      <nav className={`relative ${styles.flexCenter} w-full `}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            {!user.ID ? (
              <div
                className={`relative ${styles.flexCenter} w-10 sm:w-12 aspect-square bg-secondary/50 rounded-full`}
              >
                <HamburgerMenuIcon className="w-5 h-5 " />
              </div>
            ) : (
              <Avatar className=" border">
                {user.avatar ? <AvatarImage src={user.avatar} /> : null}
                <AvatarFallback>{user.userName.slice(0.2)}</AvatarFallback>
              </Avatar>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <div className={`relative ${styles.flexStart} flex-col w-full `}>
                <p>{user.ID ? user.userName : "Menu"} </p>
                {user.ID && (
                  <p
                    className={`${styles.Xsmall} font-light text-muted-foreground mr-12`}
                  >
                    {user.email}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href={`/`}>
              <DropdownMenuItem>Home</DropdownMenuItem>
            </Link>{" "}
            {!user.ID ? (
              <Link href={`/login`}>
                <DropdownMenuItem>Login</DropdownMenuItem>
              </Link>
            ) : (
              <>
                <Link href={`/profile/${user.ID}`}>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                </Link>{" "}
              </>
            )}{" "}
            <Link href={`/credits`}>
              <DropdownMenuItem>Credits</DropdownMenuItem>
            </Link>{" "}
            {user.ID && (
              <>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="bg-destructive text-destructive-foreground shadow-xs hover:!bg-destructive/90"
                >
                  Log out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
};

export default Header;
