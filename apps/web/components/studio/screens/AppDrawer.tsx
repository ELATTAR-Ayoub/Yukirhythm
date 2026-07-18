"use client";

import { Drawer, DrawerContent } from "@/components/ui/drawer";

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tall sheet (playlist detail) vs slightly shorter (forms). */
  height?: "95vh" | "90vh";
  children: React.ReactNode;
}

/** The one drawer surface every screens flow uses — 90/95vh, spring by vaul. */
export default function AppDrawer({
  open,
  onOpenChange,
  height = "95vh",
  children,
}: AppDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={height === "95vh" ? "h-[95vh]" : "h-[90vh]"}>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-10 pt-2">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
