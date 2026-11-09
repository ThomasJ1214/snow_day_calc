"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Fetches JSON, refreshes on an interval while the tab is visible, and exposes loading/error state. */
export function useApi<T>(url: string | null, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (${res.status}).`);
      setData(body as T);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Network error — check your connection.");
    } finally {
      if (inFlight.current === ctrl) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    if (!refreshMs) return () => clearTimeout(first);
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, refreshMs);
    const onVis = () => {
      if (!document.hidden && updatedAt && Date.now() - updatedAt > refreshMs) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      inFlight.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshMs]);

  return { data, error, loading, updatedAt, reload: load };
}
