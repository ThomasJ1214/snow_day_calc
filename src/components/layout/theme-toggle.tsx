"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("snowday:theme", next);
    } catch {
      /* private mode */
    }
    listeners.forEach((l) => l());
  };
  return (
    <button onClick={toggle} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} className="grid size-11 cursor-pointer place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-strong hover:text-text">
      {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
    </button>
  );
}

/** Inline script that applies the saved theme before paint (prevents a flash). */
export const themeScript = `try{var t=localStorage.getItem('snowday:theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;
