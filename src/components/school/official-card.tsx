import { BadgeCheck, CircleHelp, Clock3, ExternalLink, OctagonX, ShieldCheck } from "lucide-react";
import type { OfficialStatus } from "@/lib/official/status";
import { timeAgo } from "@/lib/client/format";
import { cn } from "@/components/ui/primitives";

const META = {
  officially_closed: { title: "Officially closed", icon: OctagonX, cls: "border-rose bg-rose/10", iconCls: "text-rose" },
  officially_delayed: { title: "Officially delayed", icon: Clock3, cls: "border-amber bg-amber/10", iconCls: "text-amber" },
  no_cancellation_announced: { title: "No closure announced", icon: BadgeCheck, cls: "border-mint/60 bg-mint/5", iconCls: "text-mint" },
  prediction_only: { title: "Prediction only, for now", icon: ShieldCheck, cls: "border-line-strong", iconCls: "text-ice" },
  unavailable: { title: "Official information unavailable", icon: CircleHelp, cls: "border-line-strong", iconCls: "text-text-3" },
} as const;

/** Official district status, visually distinct from SnowDay's prediction. Never derived from a probability. */
export function OfficialCard({ s }: { s: OfficialStatus }) {
  const m = META[s.status];
  return (
    <section aria-labelledby="official-h" className={cn("rounded-3xl border-2 p-5 sm:p-6", m.cls)}>
      <p className="text-sm text-text-3">Official district status</p>
      <h2 id="official-h" className="mt-1 flex items-center gap-2 font-display text-2xl font-bold">
        <m.icon className={cn("size-6", m.iconCls)} aria-hidden /> {m.title}
      </h2>
      <p className="mt-2 text-text-2">{s.headline}</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {s.sourceUrl && (
          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-ice underline-offset-4 hover:underline">
            {s.sourceName ? `Source: ${s.sourceName}` : "Source"} <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        {s.websiteUrl && (
          <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-ice underline-offset-4 hover:underline">
            District website <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        <span className="text-text-3">Checked {timeAgo(s.verifiedAt)}</span>
      </div>
      {s.status === "unavailable" && !s.websiteUrl && <p className="mt-2 text-sm text-text-3">Check your district&apos;s website, app or phone alerts for official decisions.</p>}
    </section>
  );
}
