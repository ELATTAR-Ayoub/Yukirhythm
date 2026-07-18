import SideNav from "@/components/studio/screens/SideNav";
import BottomTabBar from "@/components/studio/screens/BottomTabBar";
import GlobalPlayer from "@/components/studio/screens/GlobalPlayer";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="md:flex md:items-start md:gap-8">
      <SideNav />
      <main className="min-w-0 flex-1 pb-44 md:pb-32">{children}</main>
      <BottomTabBar />
      <GlobalPlayer />
    </div>
  );
}
