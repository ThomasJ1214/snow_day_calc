import { CircleCheck, CircleDashed, CircleSlash } from "lucide-react";
import type { LocationForecast } from "./types";
import { fmtIn, timeAgo } from "@/lib/client/format";

export function SourcesPanel({ f }: { f: LocationForecast }) {
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line">
        {f.sources.map((s) => (
          <li key={s.id} className="flex items-start gap-3 py-2.5 text-sm">
            {s.status === "ok" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-mint" aria-label="Available" />
            ) : s.status === "not_published" ? (
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-text-3" aria-label="Not published" />
            ) : (
              <CircleSlash className="mt-0.5 size-4 shrink-0 text-text-3" aria-label="Unavailable" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-text">
                {s.label} <span className="font-normal text-text-3">({s.provider}{s.resolution ? `, ${s.resolution}` : ""})</span>
              </p>
              <p className="text-text-3">
                {s.runTime ? `Run ${timeAgo(s.runTime)}. ` : ""}
                {s.note}
              </p>
            </div>
            {(s.total24Cm != null || s.total72Cm != null) && (
              <p className="shrink-0 text-right tabular text-text-2">
                {s.total24Cm != null && <span className="block">24 h {fmtIn(s.total24Cm)}</span>}
                {s.total72Cm != null && <span className="block">72 h {fmtIn(s.total72Cm)}</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
      {f.hrrrDirect && (
        <p className="text-sm text-text-2">
          HRRR decoded directly from NOAA GRIB2 (run {f.hrrrDirect.run}): {fmtIn(f.hrrrDirect.asnowCm[6])} by +6 h, {fmtIn(f.hrrrDirect.asnowCm[12])} by +12 h,{" "}
          {fmtIn(f.hrrrDirect.asnowCm[18])} by +18 h after the run started.
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-text-3">
        {f.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
