import { auth } from "@/lib/auth";
import { TopBar } from "@/components/nav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-screen h-full relative flex flex-col overflow-hidden bg-zinc-950 text-white">
       {/* TopBar can stay or we can remove it too. Let's keep it for User Menu (Logout) */}
       <TopBar />
       <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
          {children}
       </main>
    </div>
  );
}
