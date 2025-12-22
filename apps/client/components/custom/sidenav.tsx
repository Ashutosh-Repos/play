import React from "react";
import Link from "next/link";
import { BackButton } from "./back-btn";

export interface NavItem {
  icon: React.ElementType;
  title: string;
  href: string;
}

export const SideNav = ({ navLinks }: { navLinks: NavItem[] }) => {
  return (
    <div className="sm:w-16 sm:h-full w-full h-12 bg-transparent flex flex-col items-center justify-between sm:p-2 gap-4 sm:py-4 overflow-visible">
      {/* app logo only desktop */}

      <span className="aspect-square hidden sm:grid sm:place-items-center w-full h-auto rounded-full overflow-hidden cursor-pointer p-2 border-2 border-accent">
        <span className="w-full h-full flex items-center justify-center text-xl font-bold font-cursive">P</span>
      </span>

      {/* main nav */}
      <div className="w-full h-max sm:rounded-t-4xl sm:rounded-b-4xl bg-sidebar flex items-center justify-evenly sm:flex-col p-1 gap-1">
        {navLinks.map((item, idx) => {
          const Icon = item.icon;

          return (
            <Link
              href={item.href}
              key={idx + item.title}
              className="group flex items-center justify-center w-10 h-10 rounded-full hover:bg-accent transition p-1.5 relative hover:scale-125 hover:translate-x-1/4"
              title={item.title}
            >
              <Icon className="w-full h-full flex-shrink-0 text-current" />
              <span className="w-max h-max absolute opacity-0 z-20 bg-sidebar-accent/15 backdrop-blur-2xl right-0 translate-x-full px-3 p-2 text-sm rounded-l-full rounded-r-full group-hover:opacity-100 transition-all duration-700 max-sm:hidden">
                {item.title}
              </span>
            </Link>
          );
        })}

        {/* Back button */}
        <BackButton
          className="group flex items-center justify-center w-10 h-10 rounded-full hover:bg-accent transition p-1.5 relative hover:scale-125 hover:translate-x-1/4"
          iconClassName="w-full h-full flex-shrink-0 text-current"
          hoverDialog
        />
      </div>

      {/* user avatar only desktop mode */}

      <span className="aspect-square hidden sm:grid sm:place-items-center w-full h-auto rounded-full overflow-hidden hidden pointer-events-none">
        {/* /nothing */}
      </span>
    </div>
  );
};
