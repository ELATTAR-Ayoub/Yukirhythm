"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Light/dark preview toggle for the design-system pages. */
export default function ThemeFlip() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const flip = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  };

  return (
    <Button variant="outline" size="sm" onClick={flip} className="font-label">
      {dark ? "◐ Light" : "◑ Dark"}
    </Button>
  );
}
