"use client";
import { useCallback, useSyncExternalStore } from "react";

export interface SavedLocation {
  type: "location";
  name: string;
  lat: number;
  lon: number;
  slug: string;
}
export interface SavedSchool {
  type: "school";
  schoolId: string;
  name: string;
  leaid: string | null;
  lat: number;
  lon: number;
  district?: string | null;
}
export type Favorite = SavedLocation | SavedSchool;
export interface Recent {
  label: string;
  href: string;
  at: number;
}

const FAV = "snowday:favorites:v1";
const REC = "snowday:recents:v1";
const LAST = "snowday:last-seen:v1";
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try {
    value = raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    value = fallback;
  }
  cache.set(key, { raw, value });
  return value;
}
function write(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = () => l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY_FAV: Favorite[] = [];
const EMPTY_REC: Recent[] = [];
export const favKey = (f: Favorite) => (f.type === "school" ? `s:${f.schoolId}` : `l:${f.lat.toFixed(3)},${f.lon.toFixed(3)}`);

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, () => read(FAV, EMPTY_FAV), () => EMPTY_FAV);
  const isFavorite = useCallback((f: Favorite) => favorites.some((x) => favKey(x) === favKey(f)), [favorites]);
  const toggle = useCallback((f: Favorite) => {
    const list = read(FAV, EMPTY_FAV);
    const exists = list.some((x) => favKey(x) === favKey(f));
    write(FAV, exists ? list.filter((x) => favKey(x) !== favKey(f)) : [...list, f].slice(-50));
    return !exists;
  }, []);
  const replace = useCallback((list: Favorite[]) => write(FAV, list), []);
  return { favorites, isFavorite, toggle, replace };
}

export function useRecents() {
  const recents = useSyncExternalStore(subscribe, () => read(REC, EMPTY_REC), () => EMPTY_REC);
  const add = useCallback((r: Omit<Recent, "at">) => {
    const list = read(REC, EMPTY_REC).filter((x) => x.href !== r.href);
    write(REC, [{ ...r, at: Date.now() }, ...list].slice(0, 8));
  }, []);
  const clear = useCallback(() => write(REC, []), []);
  return { recents, add, clear };
}

/** Last seen likely totals per location, to flag forecast changes between visits. */
export function lastSeen(key: string): { t24: number; t72: number; at: number } | null {
  return read<Record<string, { t24: number; t72: number; at: number }>>(LAST, {})[key] ?? null;
}
export function rememberSeen(key: string, t24: number, t72: number) {
  const all = read<Record<string, { t24: number; t72: number; at: number }>>(LAST, {});
  all[key] = { t24, t72, at: Date.now() };
  const keys = Object.keys(all);
  if (keys.length > 40) delete all[keys[0]];
  window.localStorage.setItem(LAST, JSON.stringify(all));
}
