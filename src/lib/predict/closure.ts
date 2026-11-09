import { preparednessMultiplier } from "./preparedness";

export interface ClosureInput {
  /** Snow 6 PM – 7 AM local before the school day (in). */
  overnightSnowIn: number;
  /** Snow 5 AM – 8 AM local on the school day (in). */
  commuteSnowIn: number;
  totalSnow24In: number;
  /** Freezing-rain liquid overnight through the morning commute (in). */
  iceIn: number;
  morningLowF: number;
  windChillF: number;
  maxGustMph: number;
  minVisibilityMi: number | null;
  /** Active NWS alert event names, e.g. "Winter Storm Warning". */
  alerts: string[];
  /** 1991–2020 mean annual snowfall (in); null when climatology is unavailable. */
  annualSnowIn: number | null;
  /** Snow 10 AM – 3 PM local on the school day (in). */
  dismissalWindowSnowIn: number;
  /** Snowfall forecast confidence, 0–100. */
  confidence: number;
}

export interface ClosureFactor {
  key: string;
  label: string;
  detail: string;
  points: number;
}

export interface ClosurePrediction {
  closurePct: number;
  delayPct: number;
  earlyDismissal: "low" | "moderate" | "high";
  confidence: number;
  multiplier: number;
  score: number;
  factors: ClosureFactor[];
  notes: string[];
}

/** NWS alerts already encode local criteria, so their weights are not regionally scaled. */
const ALERT_POINTS: Record<string, number> = {
  "Blizzard Warning": 2.5,
  "Ice Storm Warning": 2.5,
  "Winter Storm Warning": 1.5,
  "Extreme Cold Warning": 1.5,
  "Wind Chill Warning": 1.5,
  "Lake Effect Snow Warning": 1.5,
  "Winter Weather Advisory": 0.5,
  "Cold Weather Advisory": 0.5,
  "Wind Chill Advisory": 0.5,
  "Freezing Rain Advisory": 1.0,
};

const SNOW_K = 0.7;
const ICE_K = 20;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const r1 = (v: number) => Math.round(v * 10) / 10;

export function predictClosure(input: ClosureInput): ClosurePrediction {
  const notes: string[] = [];
  let m = 1;
  if (input.annualSnowIn == null) {
    notes.push("Local snow climatology unavailable — using a neutral preparedness factor.");
  } else {
    m = preparednessMultiplier(input.annualSnowIn);
  }
  const sm = Math.sqrt(m);
  const factors: ClosureFactor[] = [];

  const snowKey = input.overnightSnowIn + 0.5 * input.commuteSnowIn;
  if (snowKey > 0) {
    factors.push({
      key: "snow",
      label: "Overnight & commute snow",
      detail: `${r1(input.overnightSnowIn)}″ overnight, ${r1(input.commuteSnowIn)}″ during the 5–8 AM commute, weighed against local preparedness (×${m.toFixed(2)})`,
      points: (SNOW_K * snowKey) / m,
    });
  }

  const daytime = Math.max(0, input.totalSnow24In - input.overnightSnowIn);
  if (daytime > 0.5) {
    factors.push({
      key: "daytime_snow",
      label: "Continuing daytime snow",
      detail: `${r1(daytime)}″ more expected later in the day`,
      points: (0.15 * daytime) / m,
    });
  }

  if (input.iceIn > 0) {
    factors.push({
      key: "ice",
      label: "Freezing rain / ice",
      detail: `${input.iceIn.toFixed(2)}″ of freezing rain — ice is disruptive even in snow-ready regions`,
      points: (ICE_K * input.iceIn) / sm,
    });
  }

  const coldThreshold = 25 - 45 * sm;
  if (input.windChillF < coldThreshold) {
    factors.push({
      key: "cold",
      label: "Dangerous wind chill",
      detail: `Wind chill ${Math.round(input.windChillF)}°F vs. a local threshold near ${Math.round(coldThreshold)}°F`,
      points: Math.min(4, 0.12 * (coldThreshold - input.windChillF)),
    });
  }

  if (input.morningLowF <= 32 && (snowKey > 0 || input.iceIn > 0)) {
    factors.push({
      key: "refreeze",
      label: "Sub-freezing roads",
      detail: `Morning low of ${Math.round(input.morningLowF)}°F keeps untreated roads slick`,
      points: 0.3,
    });
  }

  if (input.maxGustMph >= 31 && snowKey > 0.5) {
    factors.push({
      key: "blowing_snow",
      label: "Blowing snow",
      detail: `Gusts to ${Math.round(input.maxGustMph)} mph with fresh snow can drift roads`,
      points: 0.8,
    });
  }

  if (input.minVisibilityMi != null && input.minVisibilityMi < 0.6) {
    factors.push({
      key: "visibility",
      label: "Low visibility",
      detail: `Visibility as low as ${input.minVisibilityMi.toFixed(1)} mi during the morning`,
      points: 0.6,
    });
  }

  const seen = new Set<string>();
  for (const a of input.alerts) {
    const pts = ALERT_POINTS[a];
    if (pts == null || seen.has(a)) continue;
    seen.add(a);
    factors.push({ key: `alert:${a}`, label: `NWS ${a}`, detail: `Active National Weather Service ${a} for this location`, points: pts });
  }

  const score = factors.reduce((s, f) => s + f.points, 0);
  let closurePct = 0;
  let delayPct = 0;
  if (score > 0) {
    const closure = sigmoid(score - 4);
    const delay = sigmoid((score - 2.2) * 1.6) * (1 - closure);
    closurePct = Math.round(closure * 100);
    delayPct = Math.min(100 - closurePct, Math.round(delay * 100));
  }

  const dismissalPts = (0.8 * input.dismissalWindowSnowIn) / m;
  const earlyDismissal = dismissalPts >= 3.5 ? "high" : dismissalPts >= 1.8 ? "moderate" : "low";

  for (const f of factors) f.points = Math.round(f.points * 1000) / 1000;
  const roundedScore = factors.reduce((s, f) => s + f.points, 0);

  return {
    closurePct,
    delayPct,
    earlyDismissal,
    confidence: input.confidence,
    multiplier: Math.round(m * 100) / 100,
    score: roundedScore,
    factors: factors.sort((a, b) => b.points - a.points),
    notes,
  };
}
