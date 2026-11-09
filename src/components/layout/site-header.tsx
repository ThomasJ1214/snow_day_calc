"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, GitCompareArrows, Home, Map, UserRound } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/components/ui/primitives";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/national", label: "National map", icon: Map },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/account", label: "Account", icon: UserRound },
];

export function SiteHeader() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 bg-bg shadow-[0_8px_18px_-10px_var(--sh-dark)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="SnowDay home" className="inline-flex min-h-11 items-center rounded-xl">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
            {NAV.slice(1).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={cn("neu-press inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold", active(n.href) ? "text-text" : "text-text-2 hover:text-text")}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/methodology" aria-current={active("/methodology") ? "page" : undefined}
              className={cn("neu-press inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold", active("/methodology") ? "text-text" : "text-text-2 hover:text-text")}>
              How it works
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <nav aria-label="Mobile" className="fixed inset-x-3 bottom-3 z-40 md:hidden">
        <ul className="neu-raised-lg grid grid-cols-5 gap-1 rounded-[22px] p-1.5">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={cn("neu-press flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold", active(n.href) ? "text-ice" : "text-text-2")}
              >
                <n.icon className="size-5" aria-hidden />
                {n.label === "National map" ? "Map" : n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
