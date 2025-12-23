import { PiVideo } from "react-icons/pi";
import {
  IconSettings,
  IconLayoutDashboard,
  IconUser,
} from "@tabler/icons-react";
import { SideNav } from "@/components/custom/sidenav";
import { TopBar } from "@/components/top-bar/TopBar";
import { SearchForm } from "@/components/top-bar/search-form";
import { auth } from "@/lib/auth";
import { UserNav } from "@/components/top-bar/user-nav";
import { ThemeToggle } from "@/components/custom/theme-toggle";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const navItems = [
    { icon: IconLayoutDashboard, title: "Home", href: "/" },
    { icon: PiVideo, title: "Browse", href: "/browse" },
    { icon: IconSettings, title: "Settings", href: "/settings" },
  ];
  return (
    <div className="w-screen h-full relative overflow-scroll flex sm:flex-row flex-col-reverse [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <SideNav navLinks={navItems}/>
       <main className="w-full h-full overflow-y-scroll bg-background [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <TopBar>
          <SearchForm/>
          <ThemeToggle/>
          {session?.user && (
            <UserNav user={session.user} />
          )}
        </TopBar>
          {children}
       </main>
    </div>
  );
}

