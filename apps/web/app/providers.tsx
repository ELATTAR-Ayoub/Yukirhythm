"use client";

import { ThemeProvider } from "next-themes";

// components
import Header from "@/components/Header";

// Firebase
import { AuthContextProvider } from "@/context/AuthContext";

// redux
import { store_0001 } from "../store/store";
import { Provider } from "react-redux";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store_0001}>
      <AuthContextProvider>
        <ThemeProvider attribute="class">
          <Header />
          <main className={` relative w-full min-h-screen `}>{children}</main>
        </ThemeProvider>
      </AuthContextProvider>
    </Provider>
  );
}
