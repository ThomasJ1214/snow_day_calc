"use client";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useFavorites, useRecents } from "@/lib/client/storage";
import { encodeSlug } from "@/lib/geo/slug";

export function RecentChips() {
  const { recents } = useRecents();
  const { favorites } = useFavorites();
  const chips = [
    ...favorites.slice(0, 4).map((f) => ({ label: f.name, href: f.type === "school" ? `/school/${f.schoolId}` : `/forecast/${encodeSlug(f)}` })),
    ...recents.map((r) => ({ label: r.label, href: r.href })),
  ].filter((c, i, a) => a.findIndex((x) => x.href === c.href) === i);
  const list = chips.length
    ? chips.slice(0, 6)
    : [
        { label: "Montville, NJ", href: "/forecast/montville-nj--40.9154_-74.3638" },
        { label: "Montville Township High School", href: "/school/pub-341065004332" },
        { label: "Buffalo, NY", href: "/forecast/buffalo-ny--42.8864_-78.8784" },
        { label: "Denver, CO", href: "/forecast/denver-co--39.7392_-104.9903" },
      ];
  return (
    <ul className="chip-scroller -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 py-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label={chips.length ? "Your places" : "Popular places"}>
      {list.map((c) => (
        <li key={c.href} className="shrink-0">
          <Link href={c.href} className="neu-raised-sm neu-press inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-4 text-sm text-text-2 hover:text-text">
            {chips.length ? <Clock className="size-3.5 text-text-3" aria-hidden /> : null}
            {c.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
