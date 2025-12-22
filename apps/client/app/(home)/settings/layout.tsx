import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsHeader } from "@/components/settings/settings-header";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full flex-col md:flex-row">
      <SettingsNav />
      <main className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <SettingsHeader />
        </div>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
