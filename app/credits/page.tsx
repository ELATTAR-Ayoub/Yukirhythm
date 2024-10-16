"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

// styles
import styles from "@/styles/index";

// constant
import { headerLinks, socialLinks } from "@/constants/index";

// components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AuroraBackground } from "@/components/ui/aurora-background";

const Page = () => {
  return (
    <section
      className={`  relative ${styles.flexCenter} w-full h-screen ${styles.paddings} `}
    >
      <AuroraBackground className=" p-4">
        <section
          className={` relative w-full max-w-max ${styles.flexStart} flex-col gap-6 rounded-xl border bg-card text-card-foreground p-6 shadow-xl  `}
        >
          <div className={`${styles.flexStart} gap-3 w-full`}>
            <Avatar className=" border">
              <AvatarImage
                src={
                  "https://media.licdn.com/dms/image/v2/D4E03AQHwA6o49-teGw/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1687049429624?e=1732147200&v=beta&t=nOM9Ut8vO1G68M0tm8YXgtY_RRIHDRBokPlLnmTI-Jo"
                }
              />
              <AvatarFallback>EA</AvatarFallback>
            </Avatar>
            <div className={` ${styles.flexStart} text-primary flex-col`}>
              <h1 className={`${styles.small} font-semibold`}>Elattar Ayoub</h1>
              <p className={` ${styles.small} text-muted-foreground`}>
                Web & Brand Designer ✨
              </p>
            </div>
          </div>

          <div className={`${styles.flexStart} gap-2 w-full flex-wrap`}>
            {socialLinks.map((link, index) => (
              <Link href={link.url} target="_">
                <Badge className=" capitalize">{link.name}</Badge>
              </Link>
            ))}
          </div>

          <p
            className={` ${styles.XXsmall} text-muted-foreground`}
          >{`Built with <3 by ELATTAR Ayoub.`}</p>

          <p className={` ${styles.XXsmall} text-muted-foreground`}>
            Thanks to{" "}
            <Link
              className="underline hover:opacity-75"
              target="_"
              href={"https://ui.shadcn.com"}
            >
              Chadcn
            </Link>{" "}
            and{" "}
            <Link
              className="underline hover:opacity-75"
              target="_"
              href={"https://github.com/Fabricio-191/youtube"}
            >
              Fabricio-191
            </Link>{" "}
            for there fantastic libraries.
          </p>
        </section>
      </AuroraBackground>
    </section>
  );
};

export default Page;
