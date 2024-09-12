"use client";

import { ThemeProvider } from "next-themes";
import { useRouter, usePathname } from "next/navigation";

// styles
import "./globals.css";
import styles from "@/styles/index";

// components
import Header from "@/components/Header";
import CursorFollower from "@/components/CursorFollower";
import Footer from "@/components/Footer";
import SideBar from "@/components/SideBar";

// Firebase
import { AuthContextProvider } from "@/context/AuthContext";

// redux
import { store_0001 } from "../store/store";
import { Provider } from "react-redux";
import { useEffect } from "react";

export default function RootLayout({
  children,
  ...rest
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <head />
      <body
        className={` ${styles.flexStart} flex-col relative bg-background h-screen overflow-x-hidden`}
      >
        <Provider store={store_0001}>
          <AuthContextProvider>
            <ThemeProvider attribute="class">
              {/* <CursorFollower /> */}
              <Header />
              <main className={` relative w-full h-auto `}>
                <SideBar />
                {children}
              </main>
              {/* <Footer /> */}
            </ThemeProvider>
          </AuthContextProvider>
        </Provider>
      </body>
    </html>
  );
}
