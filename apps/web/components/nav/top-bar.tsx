"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { IconSun, IconMoon, IconSearch, IconBell } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TopBarProps {
  children?: React.ReactNode;
  showSearch?: boolean;
  className?: string;
}

export const TopBar = ({ children, showSearch = true, className }: TopBarProps) => {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  console.log(session, status);

  return (
    <header className={cn(
      "w-full h-14 flex items-center justify-between gap-2 px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-40 border-b border-border/40",
      className
    )}>
      {/* Logo - mobile only (desktop shows in sidebar) */}
      <Link href="/" className="sm:hidden text-xl font-bold shrink-0">
        Play
      </Link>

      {/* Custom children (e.g., search) */}
      <div className="flex items-center gap-2 flex-1 justify-center">
        {children}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search icon - mobile */}
        {showSearch && (
          <Button variant="ghost" size="icon" className="sm:hidden" asChild>
            <Link href="/search">
              <IconSearch className="w-5 h-5" />
            </Link>
          </Button>
        )}

        {/* Notifications */}
        {status === "authenticated" && (
          <Button variant="ghost" size="icon" asChild>
            <Link href="/notifications">
              <IconBell className="w-5 h-5" />
            </Link>
          </Button>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <IconSun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <IconMoon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* User menu or login */}
        {status === "loading" ? (
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        ) : status === "authenticated" && session?.user ? (
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
                <p className="text-xs text-muted-foreground">{session.user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/channel">Your channel</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/studio">Studio</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
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
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
};
