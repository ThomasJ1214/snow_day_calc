"use client";
import { useCallback } from "react";
import { useFavorites, type Favorite } from "./storage";

/** Toggles a favorite on this device and mirrors the change to the account (ignored when signed out). */
export function useFavoriteToggle() {
  const { toggle } = useFavorites();
  return useCallback(
    (item: Favorite) => {
      const added = toggle(item);
      const req = added
        ? fetch("/api/me/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [item] }) })
        : fetch(item.type === "school" ? `/api/me/saved?type=school&id=${item.schoolId}` : `/api/me/saved?type=location&lat=${item.lat}&lon=${item.lon}`, { method: "DELETE" });
      req.catch(() => undefined);
      return added;
    },
    [toggle],
  );
}
