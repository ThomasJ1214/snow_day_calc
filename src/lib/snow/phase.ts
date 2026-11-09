import { wetBulbC } from "./wetbulb";

export type Phase = "snow" | "mix" | "rain" | "freezing_rain";

export interface PhaseInput {
  tC: number;
  rh: number;
  weatherCode?: number | null;
  freezingLevelM?: number | null;
  elevationM?: number | null;
}

/** WMO weather codes for freezing drizzle (56, 57) and freezing rain (66, 67). */
const FREEZING_CODES = new Set([56, 57, 66, 67]);
/** A 0 °C level this far above a sub-freezing surface implies a warm layer aloft (melting → refreezing). */
const WARM_NOSE_DEPTH_M = 600;

export function classifyPhase(input: PhaseInput): Phase {
  const { tC, rh, weatherCode, freezingLevelM, elevationM } = input;
  if (weatherCode != null && FREEZING_CODES.has(weatherCode)) return "freezing_rain";
  if (
    tC <= 0 &&
    freezingLevelM != null &&
    freezingLevelM - (elevationM ?? 0) > WARM_NOSE_DEPTH_M
  ) {
    return "freezing_rain";
  }
  const tw = wetBulbC(tC, rh);
  if (tw <= 0.5) return "snow";
  if (tw >= 2) return "rain";
  return "mix";
}
