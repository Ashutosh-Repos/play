"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {  IconArrowLeft } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const BackButton = ({
  className,
  hoverDialog,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
  hoverDialog?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();

  // Hide if on home page
  if (pathname === "/") return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      // Remove last segment
      const segments = pathname.split("/").filter(Boolean); // remove empty ""
      segments.pop(); // remove last part
      const newPath = "/" + segments.join("/");
      router.push(newPath || "/");
    }
  };

  return (
    <span className={cn(className)}>
      <IconArrowLeft
        onClick={handleBack}
        className={cn(
          iconClassName,
          "w-10 h-10 p-1.5 hover:bg-accent rounded-full cursor-pointer"
        )}
      />
      {hoverDialog && (
        <span className="w-max h-max absolute opacity-0 z-20 bg-sidebar-accent/15 backdrop-blur-2xl right-0 translate-x-full px-3 p-2 text-sm rounded-l-full rounded-r-full group-hover:opacity-100 transition-all duration-700 max-sm:hidden">
          Go back
        </span>
      )}
    </span>
  );
};
