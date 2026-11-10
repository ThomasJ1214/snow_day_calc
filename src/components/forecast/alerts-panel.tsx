"use client";
import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import type { LocationForecast } from "./types";
import { cn } from "@/components/ui/primitives";
import { AnimatePresence, m } from "framer-motion";
import { EASE, EASE_EXIT } from "@/components/ui/motion";

const WINTER = /winter|snow|ice|freez|blizzard|cold|chill|frost|sleet|lake effect/i;

export function AlertsPanel({ alerts }: { alerts: LocationForecast["alerts"] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (alerts == null) return <p className="text-sm text-text-3">National Weather Service alerts couldn&apos;t be loaded right now.</p>;
  if (!alerts.length) return <p className="text-sm text-text-2">No active National Weather Service alerts for this location.</p>;
  const sorted = [...alerts].sort((a, b) => Number(WINTER.test(b.event)) - Number(WINTER.test(a.event)));
  return (
    <ul className="space-y-2">
      {sorted.map((a) => {
        const winter = WINTER.test(a.event);
        const isOpen = open === a.id;
        return (
          <li key={a.id} className={cn("rounded-2xl p-3.5", winter ? "neu-inset" : "neu-inset-sm")}>
            <button className="flex w-full cursor-pointer items-start gap-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : a.id)}>
              <TriangleAlert className={cn("mt-0.5 size-5 shrink-0", winter ? "text-violet" : "text-amber")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-text">{a.event}</span>
                <span className="block text-sm text-text-2">{a.headline ?? a.areaDesc}</span>
              </span>
              <ChevronDown className={cn("mt-1 size-4 shrink-0 text-text-3 transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)]", isOpen && "rotate-180")} aria-hidden />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <m.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1, transition: { height: { duration: 0.28, ease: EASE }, opacity: { duration: 0.2, delay: 0.06 } } }}
                  exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.2, ease: EASE_EXIT }, opacity: { duration: 0.12 } } }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-3 whitespace-pre-line text-sm text-text-2">
                    <p>{a.description}</p>
                    {a.instruction && <p className="text-text">{a.instruction}</p>}
                    <p className="text-text-3">Issued by {a.senderName}</p>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
