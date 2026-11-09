"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#1b2335" : "#e3eaf2");
    try {
      localStorage.setItem("snowday:theme", next);
    } catch {
      /* private mode */
    }
    listeners.forEach((l) => l());
  };
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="neu-raised-sm neu-press grid size-11 cursor-pointer place-items-center rounded-full text-text-2 hover:text-text"
    >
      {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}

/** Inline script that applies the saved theme before paint (light is the default). */
export const themeScript = `try{if(localStorage.getItem('snowday:theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;
