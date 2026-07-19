"use client";

import { Drawer, DrawerContent } from "@/components/ui/drawer";

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full sheet (playlist detail) vs shorter (forms). */
  height?: "full" | "95vh" | "90vh";
  children: React.ReactNode;
}

const HEIGHTS: Record<NonNullable<AppDrawerProps["height"]>, string> = {
  full: "h-[calc(100vh-1.5rem)]",
  "95vh": "h-[95vh]",
  "90vh": "h-[90vh]",
};

/**
 * The one drawer surface every screens flow uses — 90/95vh, spring by vaul.
 * Children must include a <DrawerTitle> (visually-hidden is fine) for a11y.
 */
export default function AppDrawer({
  open,
  onOpenChange,
  height = "95vh",
  children,
}: AppDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={HEIGHTS[height]}>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-10 pt-2">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
