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
    <ul className="mt-4 flex flex-wrap gap-2" aria-label={chips.length ? "Your places" : "Popular places"}>
      {list.map((c) => (
        <li key={c.href}>
          <Link href={c.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm text-text-2 transition-colors hover:border-ice/50 hover:text-text">
            {chips.length ? <Clock className="size-3.5 text-text-3" aria-hidden /> : null}
            {c.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
