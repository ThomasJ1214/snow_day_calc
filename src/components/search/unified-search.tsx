"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import { encodeSlug } from "@/lib/geo/slug";
import { useRecents } from "@/lib/client/storage";
import { cn } from "@/components/ui/primitives";

interface PlaceResult {
  name: string;
  detail: string;
  lat: number;
  lon: number;
}
interface SchoolResult {
  id: string;
  name: string;
  city: string | null;
  state: string;
  district: string | null;
  type: string;
}
type Option = { kind: "place"; label: string; detail: string; href: string } | { kind: "school"; label: string; detail: string; href: string };

const MONTVILLE = { lat: 40.9154, lon: -74.3638 };

/** One field for ZIP codes, cities, street addresses and school names. */
export function UnifiedSearch({ autoFocus = false, size = "lg" }: { autoFocus?: boolean; size?: "lg" | "md" }) {
  const router = useRouter();
  const { add } = useRecents();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const listId = useId();
  const near = useRef<{ lat: number; lon: number }>(MONTVILLE);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setMessage(null);
      try {
        const n = near.current;
        const [places, schools] = await Promise.all([
          fetch(`/api/geocode?q=${encodeURIComponent(term)}`, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : { results: [] })),
          term.length >= 3 || /^\d{5}$/.test(term)
            ? fetch(`/api/schools/search?q=${encodeURIComponent(term)}&lat=${n.lat}&lon=${n.lon}`, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : { results: [] }))
            : { results: [] },
        ]);
        const o: Option[] = [
          ...(places.results as PlaceResult[]).slice(0, 4).map((p) => ({ kind: "place" as const, label: p.name, detail: p.detail, href: `/forecast/${encodeSlug(p)}` })),
          ...(schools.results as SchoolResult[]).slice(0, 6).map((s) => ({
            kind: "school" as const,
            label: s.name,
            detail: `${s.district ?? (s.type === "private" ? "Private school" : "Public school")}, ${s.city ?? ""} ${s.state}`,
            href: `/school/${s.id}`,
          })),
        ];
        setOptions(o);
        setActive(0);
        setOpen(true);
        if (!o.length) setMessage("No matches. Try a 5-digit ZIP code, “City, ST”, or part of a school's name.");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setMessage("Search is temporarily unavailable. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const tooShort = q.trim().length < 2;
  const visible = tooShort ? [] : options;
  const shownMessage = tooShort ? null : message;

  const go = (o: Option) => {
    add({ label: o.label, href: o.href });
    setOpen(false);
    router.push(o.href);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("Your browser doesn't support location access.");
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        near.current = { lat, lon };
        try {
          const r = await fetch(`/api/reverse?lat=${lat}&lon=${lon}`);
          if (!r.ok) throw new Error(String(r.status));
          const { place } = await r.json();
          const href = `/forecast/${encodeSlug({ name: place.name, lat, lon })}`;
          add({ label: place.name, href });
          router.push(href);
        } catch {
          setMessage("SnowDay covers the United States. Your location appears to be outside it.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setMessage(err.code === err.PERMISSION_DENIED ? "Location permission was denied. Search by ZIP code or city instead." : "Couldn't get your location. Search by ZIP code or city instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (visible[active]) go(visible[active]);
        }}
        className={cn("glass-strong flex items-center gap-2 rounded-2xl pl-4 pr-2 shadow-[0_20px_60px_rgb(0_0_0/0.25)]", size === "lg" ? "h-16" : "h-13")}
      >
        <Search className="size-5 shrink-0 text-text-3" aria-hidden />
        <label htmlFor={`${listId}-input`} className="sr-only">
          ZIP code, city, address or school
        </label>
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open && visible.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => visible.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, visible.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="ZIP code, city, address, or school"
          className={cn("min-w-0 flex-1 bg-transparent text-text placeholder:text-text-3 focus:outline-none", size === "lg" ? "text-lg" : "text-base")}
        />
        {loading && <LoaderCircle className="size-5 animate-spin text-text-3" aria-label="Searching" />}
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-2 transition-colors hover:bg-surface-strong hover:text-text"
        >
          {locating ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <LocateFixed className="size-5" aria-hidden />}
          <span className="hidden sm:inline">Use my location</span>
          <span className="sr-only sm:hidden">Use my location</span>
        </button>
      </form>
      {open && visible.length > 0 && (
        <ul id={listId} role="listbox" className="glass-strong absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] overflow-auto rounded-2xl p-1.5 shadow-[0_24px_60px_rgb(0_0_0/0.4)]">
          {visible.map((o, i) => (
            <li
              key={o.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5", i === active && "bg-surface-strong")}
            >
              {o.kind === "place" ? <MapPin className="mt-0.5 size-4 shrink-0 text-ice" aria-hidden /> : <GraduationCap className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />}
              <span className="min-w-0">
                <span className="block truncate font-medium text-text">{o.label}</span>
                <span className="block truncate text-sm text-text-3">
                  {o.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {shownMessage && (
        <p role="status" className="mt-3 text-sm text-text-2">
          {message}
        </p>
      )}
    </div>
  );
}
