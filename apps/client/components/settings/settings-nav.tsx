"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUser, IconShield, IconDevices, IconBell, IconMenu2, IconBrandYoutube } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { href: "/settings/profile", label: "Profile", icon: IconUser, description: "Manage your public profile" },
  { href: "/settings/channel", label: "Channel", icon: IconBrandYoutube, description: "Your creator channel" },
  { href: "/settings/account", label: "Account", icon: IconShield, description: "Security and password" },
  { href: "/settings/sessions", label: "Sessions", icon: IconDevices, description: "Devices and connections" },
  { href: "/settings/notifications", label: "Notifications", icon: IconBell, description: "Email and push preferences" },
];

function NavContent({ currentPath, onNavigate }: { currentPath: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = currentPath.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <div className="flex flex-col">
              <span>{item.label}</span>
              <span className="text-xs text-muted-foreground hidden lg:block">{item.description}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/50 p-4">
        <h2 className="text-lg font-semibold mb-4 px-3">Settings</h2>
        <NavContent currentPath={pathname} />
      </aside>

      {/* Mobile Sheet Trigger */}
      <div className="md:hidden fixed bottom-4 right-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" className="rounded-full shadow-lg h-12 w-12">
              <IconMenu2 className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="p-4 border-b border-border">
              <SheetTitle className="text-lg font-semibold">Settings</SheetTitle>
            </div>
            <div className="p-4">
              <NavContent currentPath={pathname} onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
