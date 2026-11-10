"use client";
import { useState } from "react";
import { Check, Heart, Share2 } from "lucide-react";
import { useFavorites, type Favorite } from "@/lib/client/storage";
import { useFavoriteToggle } from "@/lib/client/favorite-actions";
import { cn, Segmented } from "@/components/ui/primitives";
import { AnimatePresence, m } from "framer-motion";
import { EASE } from "@/components/ui/motion";

const SWAP = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE } },
  exit: { opacity: 0, scale: 0.6, transition: { duration: 0.1 } },
};

export function FavoriteButton({ item }: { item: Favorite }) {
  const { isFavorite } = useFavorites();
  const toggle = useFavoriteToggle();
  const on = isFavorite(item);
  return (
    <button
      onClick={() => toggle(item)}
      aria-pressed={on}
      className={cn("neu-raised-sm neu-press inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-semibold", on ? "text-rose" : "text-text")}
    >
      <m.span
        initial={false}
        animate={on ? { scale: [1, 1.28, 0.94, 1], transition: { duration: 0.42, ease: EASE, times: [0, 0.35, 0.7, 1] } } : { scale: 1 }}
        className="grid place-items-center"
      >
        <Heart className={cn("size-4 transition-colors duration-200", on && "fill-current")} aria-hidden />
      </m.span>
      {on ? "Saved" : "Save"}
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* cancelled — fall back to copy */
          }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="neu-raised-sm neu-press inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-text"
    >
      <span className="relative grid size-4 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          <m.span key={copied ? "check" : "share"} {...SWAP} className="absolute inset-0 grid place-items-center">
            {copied ? <Check className="size-4 text-mint" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
          </m.span>
        </AnimatePresence>
      </span>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

export function UnitToggle({ unit, onChange }: { unit: "in" | "cm"; onChange: (u: "in" | "cm") => void }) {
  return (
    <Segmented
      label="Units"
      value={unit}
      onChange={onChange}
      options={[
        { value: "in", label: "Inches" },
        { value: "cm", label: "Centimeters" },
      ]}
    />
  );
}
