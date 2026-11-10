import { BadgeCheck, CircleHelp, Clock3, ExternalLink, OctagonX, ShieldCheck } from "lucide-react";
import type { OfficialStatus } from "@/lib/official/status";
import { timeAgo } from "@/lib/client/format";
import { cn } from "@/components/ui/primitives";

const META = {
  officially_closed: { title: "Officially closed", icon: OctagonX, cls: "bg-rose", iconCls: "text-rose" },
  officially_delayed: { title: "Officially delayed", icon: Clock3, cls: "bg-amber", iconCls: "text-amber" },
  no_cancellation_announced: { title: "No closure announced", icon: BadgeCheck, cls: "bg-mint", iconCls: "text-mint" },
  prediction_only: { title: "Prediction only, for now", icon: ShieldCheck, cls: "bg-accent", iconCls: "text-ice" },
  unavailable: { title: "Official information unavailable", icon: CircleHelp, cls: "bg-text-3", iconCls: "text-text-3" },
} as const;

/** Official district status, visually distinct from Snow Day Scout's prediction. Never derived from a probability. */
export function OfficialCard({ s }: { s: OfficialStatus }) {
  const m = META[s.status];
  return (
    <section aria-labelledby="official-h" className="neu-inset relative overflow-hidden rounded-[26px] p-5 pl-7 sm:p-7 sm:pl-9">
      <span aria-hidden className={cn("absolute inset-y-5 left-3 w-1.5 rounded-full sm:left-4", m.cls)} />
      <p className="text-sm text-text-3">Official district status</p>
      <h2 id="official-h" className="mt-1 flex items-center gap-2.5 font-display text-2xl font-bold">
        <span className="neu-raised-sm grid size-10 place-items-center rounded-full">
          <m.icon className={cn("size-5", m.iconCls)} aria-hidden />
        </span>
        {m.title}
      </h2>
      <p className="mt-2 text-text-2">{s.headline}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 text-sm">
        {s.sourceUrl && (
          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ice underline-offset-4 hover:underline">
            {s.sourceName ? `Source: ${s.sourceName}` : "Source"} <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        {s.websiteUrl && (
          <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ice underline-offset-4 hover:underline">
            District website <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        <span className="text-text-3">Checked {timeAgo(s.verifiedAt)}</span>
      </div>
      {s.status === "unavailable" && !s.websiteUrl && <p className="mt-2 text-sm text-text-3">Check your district&apos;s website, app or phone alerts for official decisions.</p>}
    </section>
  );
}
