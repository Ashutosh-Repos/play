"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  cn 
} from "@/lib/utils";
import {
  LayoutDashboard,
  PlaySquare,
  BarChart2,
  MessageSquare,
  Copyright,
  DollarSign,
  Settings,
  PenTool,
  Upload,
  ListVideo
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/studio" },
  { icon: PlaySquare, label: "Content", href: "/studio/content" },
  { icon: ListVideo, label: "Playlists", href: "/studio/playlists" },
  { icon: BarChart2, label: "Analytics", href: "/studio/analytics", disabled: true },
  { icon: MessageSquare, label: "Comments", href: "/studio/comments", disabled: true },
  { icon: Copyright, label: "Copyright", href: "/studio/copyright", disabled: true },
  { icon: DollarSign, label: "Earn", href: "/studio/earn", disabled: true },
  { icon: PenTool, label: "Customization", href: "/studio/customization", disabled: true },
  { icon: Settings, label: "Settings", href: "/studio/settings", disabled: true },
];

export function StudioSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any; 

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 border-r bg-background hidden md:flex flex-col z-30">
      
      {/* Channel Summary (Top of Sidebar) */}
      <div className="p-6 flex flex-col items-center text-center border-b">
        <Avatar className="w-24 h-24 mb-4 border-2 border-border">
          <AvatarImage src={user?.image || undefined} />
          <AvatarFallback>{user?.name?.[0] || "C"}</AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-sm">Your Channel</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">
            {user?.name || "Creator"}
        </p>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-2 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-4 px-6 h-12 rounded-none border-l-4",
                  isActive 
                    ? "border-primary font-semibold text-primary bg-secondary/50" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                asChild
                disabled={item.disabled}
              >
                <Link href={item.disabled ? "#" : item.href} aria-disabled={item.disabled}>
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Actions if needed */}
      <div className="p-4 border-t">
          <Button variant="outline" className="w-full gap-2" asChild>
              <Link href="/studio/upload">
                  <Upload className="w-4 h-4" /> Upload Video
              </Link>
          </Button>
      </div>
    </aside>
  );
}
