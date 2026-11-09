/**
 * Regional snow-preparedness multiplier from 1991–2020 mean annual snowfall (inches), spec §5.
 * ≈0.35 where it rarely snows, 1.0 at 60″/yr, capped at 1.6 for snow belts. Snow thresholds are
 * multiplied by m; ice and cold thresholds by √m (ice disrupts roads almost everywhere).
 */
export function preparednessMultiplier(annualSnowIn: number): number {
  const s = Math.max(0, annualSnowIn);
  const m = 0.35 + (0.65 * Math.log10(1 + s)) / Math.log10(1 + 60);
  return Math.min(1.6, Math.max(0.35, m));
}
