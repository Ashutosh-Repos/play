"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BackButton } from "./back-button";
import {
  IconHome,
  IconFlame,
  IconHistory,
  IconFolder,
  IconBell,
  IconShield,
  IconLayoutDashboard,
  IconUsers,
  IconVideo,
  IconFlag,
  IconSettings,
  IconBroadcast,
  IconUpload,
} from "@tabler/icons-react";

// Icon mapping - keeps icons in client component
const ICONS: Record<string, React.ElementType> = {
  home: IconHome,
  flame: IconFlame,
  history: IconHistory,
  folder: IconFolder,
  bell: IconBell,
  shield: IconShield,
  dashboard: IconLayoutDashboard,
  users: IconUsers,
  video: IconVideo,
  flag: IconFlag,
  settings: IconSettings,
  broadcast: IconBroadcast,
  upload: IconUpload,
};

export interface NavItem {
  iconName: string; // Changed from icon component to icon name
  title: string;
  href: string;
  adminOnly?: boolean;
}

interface SidebarProps {
  navItems: NavItem[];
  userRole?: string;
  avatarUrl?: string | null;
}

export const Sidebar = ({ navItems, userRole, avatarUrl }: SidebarProps) => {
  const pathname = usePathname();
  
  // Filter items based on role
  const visibleItems = navItems.filter(item => {
    if (item.adminOnly && userRole !== "ADMIN") return false;
    return true;
  });

  return (
    <div className="sm:w-16 sm:h-full w-full h-14 bg-transparent flex flex-col items-center justify-between sm:p-2 gap-2 sm:py-4 overflow-visible shrink-0">
      {/* App logo - only desktop */}
      <Link 
        href="/"
        className="aspect-square hidden sm:grid sm:place-items-center w-full h-auto rounded-full overflow-hidden cursor-pointer p-2"
      >
        <Image
          src="/logo.svg"
          alt="Play"
          width={40}
          height={40}
          className="w-full h-full dark:invert"
          priority
        />
      </Link>

      {/* Main nav */}
      <nav className="w-full h-max sm:rounded-3xl bg-sidebar flex items-center justify-evenly sm:flex-col p-1 gap-1">
        {visibleItems.map((item) => {
          const Icon = ICONS[item.iconName] || IconHome;
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              href={item.href}
              key={item.title}
              className={cn(
                "group flex items-center justify-center w-10 h-10 rounded-full transition-all p-2 relative",
                "hover:bg-accent hover:scale-110 sm:hover:translate-x-1",
                isActive && "bg-accent text-accent-foreground"
              )}
              title={item.title}
            >
              <Icon className="w-full h-full flex-shrink-0" />
              {/* Tooltip - only desktop */}
              <span className="w-max absolute opacity-0 z-20 bg-background/80 backdrop-blur-sm right-0 translate-x-full px-3 py-2 text-sm rounded-lg group-hover:opacity-100 transition-opacity duration-300 max-sm:hidden pointer-events-none">
                {item.title}
              </span>
            </Link>
          );
        })}

        {/* Back button */}
        <BackButton
          className="w-10 h-10 p-2"
          iconClassName="w-full h-full"
        />
      </nav>

      {/* User avatar - only desktop */}
      <Link
        href="/settings"
        className="aspect-square hidden sm:grid sm:place-items-center w-full h-auto border-2 border-accent rounded-full overflow-hidden cursor-pointer p-1"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="User"
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted rounded-full flex items-center justify-center">
            <span className="text-xs text-muted-foreground">?</span>
          </div>
        )}
      </Link>
    </div>
  );
};
