"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
}

export const BackButton = ({
  className,
  iconClassName,
  showLabel = false,
}: BackButtonProps) => {
  const router = useRouter();
  const pathname = usePathname();

  // Hide if on home page
  if (pathname === "/") return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      // Remove last segment and navigate
      const segments = pathname.split("/").filter(Boolean);
      segments.pop();
      const newPath = "/" + segments.join("/");
      router.push(newPath || "/");
    }
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        "group flex items-center justify-center rounded-full hover:bg-accent transition p-2 relative",
        className
      )}
      title="Go back"
    >
      <IconArrowLeft className={cn("w-5 h-5", iconClassName)} />
      {showLabel && (
        <span className="ml-2 text-sm hidden sm:inline">Back</span>
      )}
    </button>
  );
};
