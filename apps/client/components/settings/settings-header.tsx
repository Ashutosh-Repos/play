"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";

const pageTitles: Record<string, string> = {
  "/settings/profile": "Profile",
  "/settings/channel": "Channel",
  "/settings/account": "Account",
  "/settings/sessions": "Sessions",
  "/settings/notifications": "Notifications",
  "/settings": "Settings",
};

export function SettingsHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const title = pageTitles[pathname] || "Settings";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={() => router.push("/")}
      >
        <IconArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="font-semibold text-lg">{title}</h1>
    </div>
  );
}
