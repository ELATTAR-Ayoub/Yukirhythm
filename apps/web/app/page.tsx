import { redirect } from "next/navigation";
import { HOME } from "@/components/studio/shell/routes";

/** The app root is the player. The marketing landing is gone (phase 8). */
export default function RootPage() {
  redirect(HOME);
}
