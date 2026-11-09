import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...a: Parameters<typeof clsx>) => twMerge(clsx(a));

/** Raised panel: the base surface for reading content. */
export function Panel({ className, strong, ...p }: ComponentProps<"section"> & { strong?: boolean }) {
  return <section className={cn(strong ? "neu-raised-lg" : "neu-raised", "min-w-0 rounded-[26px] p-5 sm:p-7", className)} {...p} />;
}

export function PanelTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex items-baseline justify-between gap-3", className)}>
      <h2 className="font-display text-lg font-semibold tracking-tight text-text">{children}</h2>
      {aside ? <div className="text-sm text-text-3">{aside}</div> : null}
    </div>
  );
}

/** primary: the one solid action per view. ghost: a raised key that presses in. quiet: text-only. */
export function Button({ className, variant = "primary", ...p }: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "quiet" }) {
  return (
    <button
      className={cn(
        "neu-press inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "neu-raised-sm bg-accent! text-on-accent hover:brightness-110",
        variant === "ghost" && "neu-raised-sm text-text",
        variant === "quiet" && "text-text-2 hover:text-text",
        className,
      )}
      {...p}
    />
  );
}

/** Small debossed tag. Colour carries meaning; the label always says it in words too. */
export function Pill({ className, tone = "neutral", ...p }: ComponentProps<"span"> & { tone?: "neutral" | "ice" | "violet" | "rose" | "amber" | "mint" }) {
  const tones = { neutral: "text-text-2", ice: "text-ice", violet: "text-violet", rose: "text-rose", amber: "text-amber", mint: "text-mint" };
  return <span className={cn("neu-inset-sm inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", tones[tone], className)} {...p} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("neu-inset animate-pulse rounded-[22px]", className)} />;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error"; title: string; children?: ReactNode }) {
  const bar = { info: "bg-accent", warn: "bg-amber", error: "bg-rose" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className="neu-raised relative overflow-hidden rounded-[20px] py-4 pl-6 pr-4">
      <span aria-hidden className={cn("absolute inset-y-3 left-2.5 w-1 rounded-full", bar)} />
      <p className="font-semibold text-text">{title}</p>
      {children ? <div className="mt-1 text-sm text-text-2">{children}</div> : null}
    </div>
  );
}

/** Segmented control: debossed track, the chosen option rises out of it. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="neu-inset-sm inline-flex rounded-2xl p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-11 cursor-pointer rounded-xl px-4 font-semibold transition-all duration-150", value === o.value ? "neu-raised-sm text-text" : "text-text-3 hover:text-text-2")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
