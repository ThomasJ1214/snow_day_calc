"use client";
import Link from "next/link";
import { GraduationCap, MapPin, Trash2 } from "lucide-react";
import { useFavorites, useRecents, favKey } from "@/lib/client/storage";
import { useFavoriteToggle } from "@/lib/client/favorite-actions";
import { encodeSlug } from "@/lib/geo/slug";
import { Button, Panel, PanelTitle } from "@/components/ui/primitives";
import { UnifiedSearch } from "@/components/search/unified-search";

export function SavedView({ signedIn }: { signedIn: boolean }) {
  const { favorites } = useFavorites();
  const toggle = useFavoriteToggle();
  const { recents, clear } = useRecents();
  const schools = favorites.filter((f) => f.type === "school");
  const places = favorites.filter((f) => f.type === "location");
  const compareHref = `/compare?l=${places.slice(0, 4).map((p) => encodeSlug(p)).join(",")}`;
  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Saved</h1>
        <p className="mt-2 text-text-2">
          {signedIn ? "Synced to your account." : "Stored on this device. "}
          {!signedIn && (
            <Link href="/signin?next=/saved" className="text-ice underline">
              Sign in to sync across devices and get notifications.
            </Link>
          )}
        </p>
      </section>
      {favorites.length === 0 ? (
        <Panel>
          <p className="mb-4 text-text-2">Nothing saved yet. Find your school or town, then tap Save.</p>
          <UnifiedSearch size="md" />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelTitle>Schools</PanelTitle>
            {schools.length === 0 && <p className="text-sm text-text-2">No saved schools.</p>}
            <ul className="divide-y divide-line">
              {schools.map((s) => (
                <li key={favKey(s)} className="flex items-center gap-3 py-2.5">
                  <GraduationCap className="size-5 shrink-0 text-violet" aria-hidden />
                  <Link href={`/school/${s.schoolId}`} className="min-w-0 flex-1 hover:text-ice">
                    <span className="block truncate font-medium">{s.name}</span>
                    {s.district && <span className="block truncate text-sm text-text-3">{s.district}</span>}
                  </Link>
                  <button aria-label={`Remove ${s.name}`} onClick={() => toggle(s)} className="neu-press grid size-11 cursor-pointer place-items-center rounded-full text-text-3 hover:text-rose">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelTitle aside={places.length >= 2 ? <Link href={compareHref} className="text-ice hover:underline">Compare these</Link> : undefined}>Places</PanelTitle>
            {places.length === 0 && <p className="text-sm text-text-2">No saved places.</p>}
            <ul className="divide-y divide-line">
              {places.map((p) => (
                <li key={favKey(p)} className="flex items-center gap-3 py-2.5">
                  <MapPin className="size-5 shrink-0 text-ice" aria-hidden />
                  <Link href={`/forecast/${encodeSlug(p)}`} className="min-w-0 flex-1 truncate font-medium hover:text-ice">
                    {p.name}
                  </Link>
                  <button aria-label={`Remove ${p.name}`} onClick={() => toggle(p)} className="neu-press grid size-11 cursor-pointer place-items-center rounded-full text-text-3 hover:text-rose">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
      {recents.length > 0 && (
        <Panel>
          <PanelTitle aside={<Button variant="quiet" onClick={clear}>Clear history</Button>}>Recently viewed</PanelTitle>
          <ul className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="neu-raised-sm neu-press inline-flex min-h-10 items-center rounded-2xl px-3.5 text-sm text-text-2 hover:text-text">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
