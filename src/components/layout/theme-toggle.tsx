"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { AnimatePresence, m } from "framer-motion";
import { EASE } from "@/components/ui/motion";

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
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = next;
      listeners.forEach((l) => l());
    };
    // The whole palette changes as one gentle crossfade rather than a flash.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (reduce) apply();
    else if (doc.startViewTransition) doc.startViewTransition(apply);
    else {
      root.classList.add("theme-switching");
      apply();
      window.setTimeout(() => root.classList.remove("theme-switching"), 380);
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#1b2335" : "#e3eaf2");
    try {
      localStorage.setItem("snowday:theme", next);
    } catch {
      /* private mode */
    }
  };
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="neu-raised-sm neu-press grid size-11 cursor-pointer place-items-center rounded-full text-text-2 hover:text-text"
    >
      <span className="relative grid size-5 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            key={theme ?? "none"}
            initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1, transition: { duration: 0.32, ease: EASE } }}
            exit={{ opacity: 0, rotate: 60, scale: 0.7, transition: { duration: 0.16 } }}
            className="absolute inset-0 grid place-items-center"
          >
            {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
          </m.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

/** Inline script that applies the saved theme before paint (light is the default). */
export const themeScript = `try{if(localStorage.getItem('snowday:theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;
