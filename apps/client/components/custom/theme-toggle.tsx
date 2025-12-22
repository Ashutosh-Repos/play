"use client"
import * as React from "react"
import { useTheme } from "next-themes"
import { IconSun, IconMoon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button"

export const ThemeToggle = ({ className }: { className?: string }) => {
    const { theme, setTheme } = useTheme()
    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark")
    }
    return (
        // this will give hydration error
        // <Button variant="ghost" size="icon" onClick={toggleTheme}>
        //     {theme === "dark" ? <IconMoon /> : <IconSun />}
        // </Button>

        // this will not give hydration error
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={className}
          >
          <IconSun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <IconMoon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
