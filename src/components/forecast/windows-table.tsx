import type { SnowAnalysis, WindowKey } from "./types";
import { fmtCm, fmtIn } from "@/lib/client/format";

const KEYS: WindowKey[] = ["3", "6", "12", "24", "48", "72"];

export function WindowsTable({ snow }: { snow: SnowAnalysis }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm tabular">
        <caption className="sr-only">Snowfall totals for upcoming time windows: low, most likely and high estimates</caption>
        <thead>
          <tr className="text-text-3">
            <th scope="col" className="py-2 pr-3 font-medium">Next</th>
            <th scope="col" className="py-2 pr-3 font-medium">Low</th>
            <th scope="col" className="py-2 pr-3 font-medium text-text">Most likely</th>
            <th scope="col" className="py-2 pr-3 font-medium">High</th>
          </tr>
        </thead>
        <tbody>
          {KEYS.map((k) => {
            const w = snow.windows[k];
            const missing = snow.unavailableWindows.includes(k);
            return (
              <tr key={k} className="border-t border-line">
                <th scope="row" className="py-2.5 pr-3 font-medium text-text-2">{k} hours</th>
                {missing ? (
                  <td colSpan={3} className="py-2.5 text-text-3">Beyond available model data</td>
                ) : (
                  <>
                    <td className="py-2.5 pr-3 text-text-2">{fmtIn(w.low)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-display text-base font-semibold text-text">{fmtIn(w.likely)}</span>
                      <span className="ml-2 text-text-3">{fmtCm(w.likely)}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-text-2">{fmtIn(w.high)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
