import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...a: Parameters<typeof clsx>) => twMerge(clsx(a));

export function Panel({ className, strong, ...p }: ComponentProps<"section"> & { strong?: boolean }) {
  return <section className={cn(strong ? "glass-strong" : "glass", "min-w-0 rounded-3xl p-5 sm:p-6", className)} {...p} />;
}

export function PanelTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-baseline justify-between gap-3", className)}>
      <h2 className="font-display text-lg font-semibold tracking-tight text-text">{children}</h2>
      {aside ? <div className="text-sm text-text-3">{aside}</div> : null}
    </div>
  );
}

export function Button({ className, variant = "primary", ...p }: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "quiet" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-ice text-[#06122b] hover:bg-ice-2 hover:text-white",
        variant === "ghost" && "border border-line-strong text-text hover:bg-surface-strong",
        variant === "quiet" && "text-text-2 hover:bg-surface hover:text-text",
        className,
      )}
      {...p}
    />
  );
}

export function Pill({ className, tone = "neutral", ...p }: ComponentProps<"span"> & { tone?: "neutral" | "ice" | "violet" | "rose" | "amber" | "mint" }) {
  const tones = {
    neutral: "border-line text-text-2",
    ice: "border-ice/40 text-ice",
    violet: "border-violet/40 text-violet",
    rose: "border-rose/50 text-rose",
    amber: "border-amber/50 text-amber",
    mint: "border-mint/50 text-mint",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...p} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-surface-strong", className)} />;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error"; title: string; children?: ReactNode }) {
  const t = { info: "border-ice/30", warn: "border-amber/40", error: "border-rose/50" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("glass rounded-2xl border-l-4 p-4", t)}>
      <p className="font-semibold text-text">{title}</p>
      {children ? <div className="mt-1 text-sm text-text-2">{children}</div> : null}
    </div>
  );
}
