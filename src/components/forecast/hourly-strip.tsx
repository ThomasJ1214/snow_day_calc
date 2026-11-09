import type { HourPoint } from "./types";
import { cToF, fmtLocal, kmhToMph, mToMi } from "@/lib/client/format";
import { cn } from "@/components/ui/primitives";

const PHASE: Record<string, { label: string; cls: string }> = {
  snow: { label: "Snow", cls: "text-ice" },
  mix: { label: "Mix", cls: "text-violet" },
  rain: { label: "Rain", cls: "text-text-2" },
  freezing_rain: { label: "Ice", cls: "text-rose" },
};

/** Next 48 hours in 3-hour steps: precipitation type, snowfall rate, temperature, wind and visibility. */
export function HourlyStrip({ hourly, unit }: { hourly: HourPoint[]; unit: "in" | "cm" }) {
  const rows = hourly.filter((h) => !h.past).filter((_, i) => i % 3 === 0).slice(0, 16);
  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <table className="w-max text-center text-sm tabular">
        <caption className="sr-only">Hourly conditions every three hours</caption>
        <tbody>
          <tr>
            <th scope="row" className="sticky left-0 bg-bg-2/80 px-2 text-left font-medium text-text-3 backdrop-blur">Time</th>
            {rows.map((h) => (
              <td key={h.time} className="px-3 py-1.5 font-medium text-text">{fmtLocal(h.time, { weekday: "short", hour: "numeric" })}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 bg-bg-2/80 px-2 text-left font-medium text-text-3 backdrop-blur">Type</th>
            {rows.map((h) => (
              <td key={h.time} className={cn("px-3 py-1.5", h.phase ? PHASE[h.phase].cls : "text-text-3")}>{h.phase ? PHASE[h.phase].label : "Dry"}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 bg-bg-2/80 px-2 text-left font-medium text-text-3 backdrop-blur">Snow/h</th>
            {rows.map((h) => (
              <td key={h.time} className="px-3 py-1.5 text-text">{unit === "in" ? `${(h.rateLikely / 2.54).toFixed(1)}″` : `${h.rateLikely.toFixed(1)}`}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 bg-bg-2/80 px-2 text-left font-medium text-text-3 backdrop-blur">Temp</th>
            {rows.map((h) => (
              <td key={h.time} className="px-3 py-1.5 text-text-2">{h.tempC == null ? "—" : unit === "in" ? `${cToF(h.tempC)}°F` : `${Math.round(h.tempC)}°C`}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 bg-bg-2/80 px-2 text-left font-medium text-text-3 backdrop-blur">Gusts</th>
            {rows.map((h) => (
              <td key={h.time} className="px-3 py-1.5 text-text-2">{h.gustKmh == null ? "—" : unit === "in" ? `${kmhToMph(h.gustKmh)} mph` : `${Math.round(h.gustKmh)} km/h`}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 bg-bg-2/80 px-2 text-left font-medium text-text-3 backdrop-blur">Visibility</th>
            {rows.map((h) => (
              <td key={h.time} className="px-3 py-1.5 text-text-2">
                {h.visibilityM == null ? "—" : unit === "in" ? `${Math.min(10, mToMi(h.visibilityM)).toFixed(mToMi(h.visibilityM) < 1 ? 1 : 0)} mi` : `${Math.min(16, h.visibilityM / 1000).toFixed(0)} km`}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
