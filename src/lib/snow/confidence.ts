export interface Confidence {
  score: number;
  label: "High" | "Moderate" | "Low";
  reasons: string[];
}

/**
 * Forecast confidence 0–100 from model agreement and lead time (spec §4).
 * spreadRatio = (p90 − p10) / max(likely, 2.5 cm); each 1.0 of ratio costs 30 points (max 60).
 * Lead time costs 1 point per 6 h until onset (max 25). Model-spread fallback (few sources) costs 10.
 */
export function computeConfidence(args: {
  low: number;
  likely: number;
  high: number;
  hoursToOnset: number | null;
  method: "ensemble" | "model-spread";
  sourceCount: number;
}): Confidence {
  const reasons: string[] = [];
  const ratio = (args.high - args.low) / Math.max(args.likely, 2.5);
  const spreadPenalty = Math.min(60, ratio * 30);
  if (spreadPenalty >= 25) reasons.push("Models disagree substantially on totals");
  else if (spreadPenalty >= 10) reasons.push("Moderate spread between model solutions");
  else reasons.push("Models are in close agreement");

  const leadPenalty = args.hoursToOnset == null ? 0 : Math.min(25, args.hoursToOnset / 6);
  if (args.hoursToOnset != null && args.hoursToOnset >= 36) reasons.push("Snow onset is more than a day and a half away");

  let methodPenalty = 0;
  if (args.method === "model-spread") {
    methodPenalty = 10;
    reasons.push(`Ensemble data unavailable; range from ${args.sourceCount} deterministic models`);
  }
  const score = Math.round(Math.max(0, Math.min(100, 100 - spreadPenalty - leadPenalty - methodPenalty)));
  const label = score >= 70 ? "High" : score >= 40 ? "Moderate" : "Low";
  return { score, label, reasons };
}
