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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={session.user.avatarUrl ?? undefined} />
                    <AvatarFallback>
                      {session.user.displayName?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{session.user.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{session.user.username}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/u/${session.user.username}`}>
                    <IconUser className="mr-2 h-4 w-4" />
                    View Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <IconSettings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {session.user.role === "ADMIN" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="text-primary">
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/api/auth/signout">Sign out</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TopBar>
          {children}
       </main>
    </div>
  );
}

