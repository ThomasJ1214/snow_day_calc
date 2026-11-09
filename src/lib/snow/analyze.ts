import type { HourlySeries } from "@/lib/weather/types";
import { classifyPhase, type Phase } from "./phase";
import { slrFor } from "./slr";
import { median, percentile } from "./percentiles";
import { WINDOWS, cumulative, windowTotals } from "./accumulate";
import { computeConfidence, type Confidence } from "./confidence";

export const HORIZON_HOURS = 72;
const MEASURABLE_CM = 0.25; // 0.1 inch
const SNOWING_RATE_CM = 0.1;

export type WindowKey = "3" | "6" | "12" | "24" | "48" | "72";
export interface Range {
  low: number;
  likely: number;
  high: number;
}

export interface HourPoint {
  time: string;
  rateLow: number;
  rateLikely: number;
  rateHigh: number;
  cumLow: number | null;
  cumLikely: number | null;
  cumHigh: number | null;
  tempC: number | null;
  rh: number | null;
  gustKmh: number | null;
  windKmh: number | null;
  visibilityM: number | null;
  precipMm: number | null;
  phase: Phase | null;
  iceMm: number;
  /** True for hours before "now" (model analysis of what likely already fell). */
  past: boolean;
}

export interface SnowAnalysis {
  method: "ensemble" | "model-spread";
  sourceCount: number;
  windows: Record<WindowKey, Range>;
  /** Windows that no source covered completely (shown as unavailable, never as 0). */
  unavailableWindows: WindowKey[];
  hourly: HourPoint[];
  daily: { date: string; lowCm: number; likelyCm: number; highCm: number }[];
  startTime: string | null;
  endTime: string | null;
  peakRateCmH: number;
  peakTime: string | null;
  pMeasurable: number | null;
  iceRiskMm: number;
  transitions: { time: string; from: Phase; to: Phase }[];
  confidence: Confidence;
  modelTotals: Record<string, { total24: number | null; total48: number | null; total72: number | null; horizonHours: number }>;
}

export interface AnalyzeInput {
  deterministic: Record<string, HourlySeries>;
  ensemble: HourlySeries[];
  nowIndex: number;
  elevationM?: number | null;
  /** Preferred deterministic model ids for weather display fields, best first. */
  primaryOrder?: string[];
  /** Field-wise composite used for temperature/wind/visibility display (not part of the spread). */
  display?: HourlySeries;
  /** Include up to this many hours before now in `hourly` (flagged past), e.g. overnight snow already fallen. */
  lookbackHours?: number;
}

function phaseAt(s: HourlySeries, i: number, elevationM?: number | null): Phase | null {
  const t = s.tempC[i];
  if (t == null) return null;
  return classifyPhase({
    tC: t,
    rh: s.rh[i] ?? 90,
    weatherCode: s.weatherCode[i],
    freezingLevelM: s.freezingLevelM?.[i] ?? null,
    elevationM,
  });
}

/**
 * Snowfall (cm) for one hour of one source (spec §4): snow-phase liquid × temperature-dependent
 * SLR. Model-reported snowfall is a cross-check — outside a clean snow phase the lower of the
 * two is used, so 10:1 model snow in marginal air is not overstated.
 */
export function hourlySnowCm(s: HourlySeries, i: number, elevationM?: number | null): number | null {
  const precip = s.precipMm[i];
  const model = s.snowfallCm[i];
  if (precip == null) return model ?? null;
  if (precip <= 0) return 0;
  const phase = phaseAt(s, i, elevationM);
  if (phase == null) return model ?? null;
  const t = s.tempC[i] as number;
  const liquid = phase === "snow" ? precip : phase === "mix" ? precip * 0.5 : 0;
  const calc = (liquid * slrFor(t, s.gustKmh[i] ?? 0)) / 10;
  if (phase === "snow" || model == null) return calc;
  return Math.min(calc, model);
}

function iceMmAt(s: HourlySeries, i: number, elevationM?: number | null): number {
  const precip = s.precipMm[i];
  if (precip == null || precip <= 0) return 0;
  return phaseAt(s, i, elevationM) === "freezing_rain" ? precip : 0;
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const nn = (v: number) => (Number.isFinite(v) ? v : 0);

export function analyzeSnow(input: AnalyzeInput): SnowAnalysis {
  const { deterministic, ensemble, nowIndex, elevationM } = input;
  const detIds = Object.keys(deterministic);
  const method: SnowAnalysis["method"] = ensemble.length >= 3 ? "ensemble" : "model-spread";
  const members: HourlySeries[] = method === "ensemble" ? ensemble : detIds.map((id) => deterministic[id]);
  const primaryId = (input.primaryOrder ?? []).find((id) => deterministic[id]) ?? detIds[0];
  const primary: HourlySeries | undefined = input.display ?? (primaryId ? deterministic[primaryId] : members[0]);

  const memberSnow = members.map((s) => s.time.map((_, i) => hourlySnowCm(s, i, elevationM)));
  const memberWindows = memberSnow.map((arr) => windowTotals(arr, nowIndex));

  const windows = {} as Record<WindowKey, Range>;
  const unavailableWindows: WindowKey[] = [];
  for (const w of WINDOWS) {
    const key = String(w) as WindowKey;
    const totals = memberWindows.map((mw) => mw[w]).filter((v): v is number => v != null);
    if (totals.length === 0) {
      unavailableWindows.push(key);
      windows[key] = { low: 0, likely: 0, high: 0 };
      continue;
    }
    windows[key] =
      method === "ensemble"
        ? { low: round(percentile(totals, 0.1)), likely: round(percentile(totals, 0.5)), high: round(percentile(totals, 0.9)) }
        : { low: round(Math.min(...totals)), likely: round(median(totals)), high: round(Math.max(...totals)) };
  }

  // Hourly series over the horizon.
  const timeline = (primary ?? members[0])?.time ?? [];
  const horizon = Math.max(0, Math.min(HORIZON_HOURS, timeline.length - nowIndex));
  const memberCum = memberSnow.map((arr) => cumulative(arr, nowIndex, horizon));
  const lookback = Math.min(input.lookbackHours ?? 0, nowIndex);
  const hourly: HourPoint[] = [];
  for (let h = -lookback; h < horizon; h++) {
    const i = nowIndex + h;
    const past = h < 0;
    const rates = memberSnow.map((arr) => arr[i]).filter((v): v is number => v != null);
    const cums = past ? [] : memberCum.map((c) => c[h]).filter((v): v is number => v != null);
    const lowP = method === "ensemble" ? 0.1 : 0;
    const highP = method === "ensemble" ? 0.9 : 1;
    hourly.push({
      time: timeline[i],
      rateLow: round(nn(percentile(rates, lowP))),
      rateLikely: round(nn(median(rates))),
      rateHigh: round(nn(percentile(rates, highP))),
      cumLow: cums.length ? round(percentile(cums, lowP)) : null,
      cumLikely: cums.length ? round(median(cums)) : null,
      cumHigh: cums.length ? round(percentile(cums, highP)) : null,
      tempC: primary?.tempC[i] ?? null,
      rh: primary?.rh[i] ?? null,
      gustKmh: primary?.gustKmh[i] ?? null,
      windKmh: primary?.windKmh[i] ?? null,
      visibilityM: primary?.visibilityM[i] ?? null,
      precipMm: primary?.precipMm[i] ?? null,
      phase: primary && (primary.precipMm[i] ?? 0) > 0 ? phaseAt(primary, i, elevationM) : null,
      iceMm: primary ? round(iceMmAt(primary, i, elevationM)) : 0,
      past,
    });
  }

  // Daily totals by local calendar date (the date part of the local time string).
  const future = hourly.filter((p) => !p.past);
  const dayKeys = [...new Set(future.map((p) => p.time.slice(0, 10)))];
  const daily = dayKeys.map((date) => {
    const totals = memberSnow
      .map((arr) => {
        let sum = 0;
        for (let h = 0; h < horizon; h++) {
          const i = nowIndex + h;
          if (timeline[i].slice(0, 10) !== date) continue;
          const v = arr[i];
          if (v == null) return null;
          sum += v;
        }
        return sum;
      })
      .filter((v): v is number => v != null);
    const lowP = method === "ensemble" ? 0.1 : 0;
    const highP = method === "ensemble" ? 0.9 : 1;
    return {
      date,
      lowCm: round(nn(percentile(totals, lowP))),
      likelyCm: round(nn(median(totals))),
      highCm: round(nn(percentile(totals, highP))),
    };
  });

  const snowing = future.filter((p) => p.rateLikely >= SNOWING_RATE_CM);
  const startTime = snowing[0]?.time ?? null;
  const endTime = snowing.at(-1)?.time ?? null;
  let peakRateCmH = 0;
  let peakTime: string | null = null;
  for (const p of future) {
    if (p.rateLikely > peakRateCmH) {
      peakRateCmH = p.rateLikely;
      peakTime = p.time;
    }
  }

  const totals72 = memberWindows.map((mw) => mw[72]).filter((v): v is number => v != null);
  const pMeasurable =
    method === "ensemble" && totals72.length > 0 ? totals72.filter((t) => t >= MEASURABLE_CM).length / totals72.length : null;

  const iceTotals = detIds.map((id) => {
    const s = deterministic[id];
    let sum = 0;
    for (let h = 0; h < horizon && nowIndex + h < s.time.length; h++) sum += iceMmAt(s, nowIndex + h, elevationM);
    return sum;
  });
  const iceRiskMm = iceTotals.length ? round(median(iceTotals)) : 0;

  const transitions: SnowAnalysis["transitions"] = [];
  let last: Phase | null = null;
  for (const p of future) {
    if (!p.phase) continue;
    if (last && p.phase !== last) transitions.push({ time: p.time, from: last, to: p.phase });
    last = p.phase;
  }

  const modelTotals: SnowAnalysis["modelTotals"] = {};
  for (const id of detIds) {
    const s = deterministic[id];
    const arr = s.time.map((_, i) => hourlySnowCm(s, i, elevationM));
    const w = windowTotals(arr, nowIndex);
    let horizonHours = 0;
    for (let i = nowIndex; i < arr.length && arr[i] != null; i++) horizonHours++;
    modelTotals[id] = {
      total24: w[24] == null ? null : round(w[24]),
      total48: w[48] == null ? null : round(w[48]),
      total72: w[72] == null ? null : round(w[72]),
      horizonHours,
    };
  }

  const best = windows["72"].likely > 0 || unavailableWindows.includes("72") ? windows["72"] : windows["24"];
  const hoursToOnset = startTime ? future.findIndex((p) => p.time === startTime) : null;
  const confidence = computeConfidence({
    low: best.low,
    likely: best.likely,
    high: best.high,
    hoursToOnset,
    method,
    sourceCount: members.length,
  });

  return {
    method,
    sourceCount: members.length,
    windows,
    unavailableWindows,
    hourly,
    daily,
    startTime,
    endTime,
    peakRateCmH: round(peakRateCmH),
    peakTime,
    pMeasurable,
    iceRiskMm,
    transitions,
    confidence,
    modelTotals,
  };
}
