"use client";
import { useId } from "react";
import { m } from "framer-motion";
import { clsx as cn } from "clsx";
import { SLIDE } from "./motion";

/**
 * Segmented control: a debossed track with one raised key that slides to the chosen option,
 * so the eye follows the change instead of seeing two buttons swap styles.
 */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="neu-inset-sm inline-flex rounded-2xl p-1 text-sm">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("relative min-h-11 cursor-pointer rounded-xl px-4 font-semibold transition-colors duration-200", on ? "text-text" : "text-text-3 hover:text-text-2")}
          >
            {on && <m.span layoutId={`seg-${id}`} transition={SLIDE} aria-hidden className="neu-raised-sm absolute inset-0 rounded-xl" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
