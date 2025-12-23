import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { ThemeToggle } from "@/components/custom/theme-toggle"; 
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Video } from "lucide-react";
import { UserNav } from "@/components/top-bar/user-nav"; // Assuming existing UserNav

import { auth } from "@/lib/auth";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-background">
      {/* Studio Header - Distinct from Main Site */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/studio" className="flex items-center gap-2 font-bold text-xl px-2">
            <Video className="w-6 h-6 text-red-600" />
            <span>Studio</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
           {/* Search Bar could go here */}
           <Button variant="ghost" size="sm" asChild>
               <Link href="/">Back to YouTube</Link>
           </Button>
           {session?.user && <UserNav user={session.user} />}
        </div>
      </header>

      {/* Sidebar & Content */}
      <div className="pt-16 flex min-h-screen">
        <StudioSidebar />
        
        <main className="flex-1 md:ml-64 bg-secondary/10 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
