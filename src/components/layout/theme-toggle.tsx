"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("snowday:theme", next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  };
  return (
    <button onClick={toggle} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} className="grid size-11 cursor-pointer place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-strong hover:text-text">
      {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
    </button>
  );
}

/** Inline script that applies the saved theme before paint (prevents a flash). */
export const themeScript = `try{var t=localStorage.getItem('snowday:theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;
