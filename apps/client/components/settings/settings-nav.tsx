"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUser, IconShield, IconDevices, IconBell, IconMenu2, IconBrandYoutube, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
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
              "flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200",
              isActive
                ? "bg-primary/10 text-primary font-medium shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              isActive ? "bg-primary/15" : "bg-muted/50"
            )}>
              <item.icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span>{item.label}</span>
              <span className="text-xs text-muted-foreground/80 hidden lg:block">{item.description}</span>
            </div>
            {isActive && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Find current nav item for mobile header
  const currentItem = navItems.find(item => pathname.startsWith(item.href));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/50 bg-card/30 p-4">
        <h2 className="text-lg font-bold mb-6 px-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Settings
        </h2>
        <NavContent currentPath={pathname} />
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border/50 safe-area-pb">
        <nav className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 4).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-all duration-200",
                  isActive && "bg-primary/10 scale-110"
                )}>
                  <item.icon className={cn("h-5 w-5", isActive && "animate-in zoom-in duration-200")} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-opacity",
                  isActive ? "opacity-100" : "opacity-70"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button for remaining items */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="p-1.5 rounded-lg">
                  <IconMenu2 className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium opacity-70">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
              <div className="flex items-center justify-between mb-4">
                <SheetTitle className="text-lg font-semibold">More Settings</SheetTitle>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <IconX className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
              <NavContent currentPath={pathname} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </nav>
      </div>

      {/* Mobile header with current page indicator */}
      <div className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50 px-4 py-3 -mx-4 -mt-6 mb-4">
        <div className="flex items-center gap-3">
          {currentItem && (
            <>
              <div className="p-2 rounded-lg bg-primary/10">
                <currentItem.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold">{currentItem.label}</h1>
                <p className="text-xs text-muted-foreground">{currentItem.description}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

