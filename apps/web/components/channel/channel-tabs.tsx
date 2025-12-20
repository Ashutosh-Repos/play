"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ChannelTabsProps {
  handle: string;
}

export function ChannelTabs({ handle }: ChannelTabsProps) {
  const pathname = usePathname();
  const basePath = `/channel/${handle}`;

  const tabs = [
    { label: "Home", href: basePath },
    { label: "Videos", href: `${basePath}/videos` },
    { label: "Playlists", href: `${basePath}/playlists` },
    { label: "About", href: `${basePath}/about` },
  ];

  return (
    <nav className="border-b">
      <div className="flex gap-1 overflow-x-auto hide-scrollbar px-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || 
            (tab.href !== basePath && pathname.startsWith(tab.href));
          
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
