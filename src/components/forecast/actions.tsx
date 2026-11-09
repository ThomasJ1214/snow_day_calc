"use client";
import { useState } from "react";
import { Check, Heart, Share2 } from "lucide-react";
import { useFavorites, type Favorite } from "@/lib/client/storage";
import { cn } from "@/components/ui/primitives";

export function FavoriteButton({ item }: { item: Favorite }) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(item);
  return (
    <button
      onClick={() => {
        const added = toggle(item);
        if (added) fetch("/api/me/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [item] }) }).catch(() => undefined);
        else
          fetch(
            item.type === "school" ? `/api/me/saved?type=school&id=${item.schoolId}` : `/api/me/saved?type=location&id=`,
            { method: "DELETE" },
          ).catch(() => undefined);
      }}
      aria-pressed={on}
      className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors", on ? "border-rose/50 bg-rose/10 text-rose" : "border-line-strong text-text hover:bg-surface-strong")}
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
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-strong"
    >
      {copied ? <Check className="size-4 text-mint" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

export function UnitToggle({ unit, onChange }: { unit: "in" | "cm"; onChange: (u: "in" | "cm") => void }) {
  return (
    <div role="radiogroup" aria-label="Units" className="inline-flex rounded-full border border-line p-0.5 text-sm">
      {(["in", "cm"] as const).map((u) => (
        <button key={u} role="radio" aria-checked={unit === u} onClick={() => onChange(u)} className={cn("min-h-9 cursor-pointer rounded-full px-3 font-medium", unit === u ? "bg-surface-strong text-text" : "text-text-3")}>
          {u === "in" ? "Inches" : "Centimeters"}
        </button>
      ))}
    </div>
  );
}
