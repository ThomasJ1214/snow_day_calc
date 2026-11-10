"use client";
import Link from "next/link";
import type { SchoolPrediction } from "@/components/forecast/types";
import { SnowStake } from "@/components/forecast/snow-stake";
import { Snowfall, snowIntensity } from "@/components/layout/snowfall";
import { Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/client/use-api";
import { fmtIn } from "@/lib/client/format";
import { TweenNumber } from "@/components/ui/tween-number";
import { m } from "framer-motion";
import { REVEAL } from "@/components/ui/motion";

const pct = (v: number) => `${Math.round(v)}%`;
const MTHS = "pub-341065004332";
const STATUS: Record<string, string> = {
  officially_closed: "Officially closed",
  officially_delayed: "Officially delayed",
  no_cancellation_announced: "No closure announced",
  prediction_only: "No decision posted yet",
  unavailable: "Official status unavailable",
};

/** Live Montville, NJ snapshot (the primary audience): snow stake, school odds, official status. */
export function MontvilleCard() {
  const { data: p, error } = useApi<SchoolPrediction>(`/api/school-forecast/${MTHS}`, 10 * 60_000);
  if (error) return <p className="neu-raised rounded-[26px] p-6 text-sm text-text-2">Montville&apos;s live forecast is temporarily unavailable.</p>;
  if (!p) return <Skeleton className="h-[340px] w-full" />;
  const w = p.forecast.snow.windows["72"];
  return (
    <m.article {...REVEAL} className="neu-raised-lg relative overflow-hidden rounded-[30px] p-6 sm:p-7">
      <Snowfall intensity={snowIntensity(p.forecast.snow.windows["24"].likely)} />
      <div className="relative flex gap-4 sm:gap-6">
        <div className="w-20 shrink-0 min-[400px]:w-28 sm:w-36">
          <SnowStake lowCm={w.low} likelyCm={w.likely} highCm={w.high} height={250} title="Montville snow in the next 72 hours" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Montville, NJ right now</h2>
          <p className="mt-3 text-sm text-text-2">Next 72 hours</p>
          <p className="font-display text-5xl font-extrabold leading-none tabular">
            <TweenNumber value={w.likely} format={fmtIn} />
          </p>
          <p className="mt-1 text-sm text-text-3 tabular">{w.high === 0 ? "No snow expected" : `${fmtIn(w.low)} to ${fmtIn(w.high)}`}</p>
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm text-text-2">Montville Township High School, {p.targetDayLabel.split(",")[0]}</p>
            {p.prediction ? (
              <p className="mt-1 flex flex-wrap gap-x-4 text-lg tabular">
                <span className="whitespace-nowrap">
                  <span className="font-display text-2xl font-bold text-rose">
                    <TweenNumber value={p.prediction.closurePct} format={pct} duration={900} />
                  </span> closed
                </span>
                <span className="whitespace-nowrap">
                  <span className="font-display text-2xl font-bold text-amber">
                    <TweenNumber value={p.prediction.delayPct} format={pct} duration={900} />
                  </span> delayed
                </span>
              </p>
            ) : (
              <p className="mt-1 text-text-2">Not yet in forecast range</p>
            )}
            <p className="mt-1 text-sm text-text-3">{STATUS[p.official.status]} on montville.net</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 text-sm font-semibold">
            <Link href={`/school/${MTHS}`} className="inline-flex min-h-11 items-center text-ice underline-offset-4 hover:underline">
              Montville schools
            </Link>
            <Link href="/forecast/montville-nj--40.9154_-74.3638" className="inline-flex min-h-11 items-center text-ice underline-offset-4 hover:underline">
              Hour-by-hour snow
            </Link>
          </div>
        </div>
      </div>
    </m.article>
  );
}
