"use client";
import { useState } from "react";
import { Check, Heart, Share2 } from "lucide-react";
import { useFavorites, type Favorite } from "@/lib/client/storage";
import { useFavoriteToggle } from "@/lib/client/favorite-actions";
import { cn, Segmented } from "@/components/ui/primitives";

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
      <Heart className={cn("size-4", on && "fill-current")} aria-hidden />
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
      {copied ? <Check className="size-4 text-mint" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
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
