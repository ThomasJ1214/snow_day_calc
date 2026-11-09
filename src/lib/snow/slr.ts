/**
 * Snow-to-liquid ratio from 2 m temperature (°C), a surface approximation of
 * temperature-dependent ratios (cf. Kuchera; Roebber et al. 2003). Strong gusts fragment
 * dendrites and compact snow, so ratios drop 20% when gusts exceed 40 km/h.
 */
export function slrFor(tC: number, gustKmh: number): number {
  let ratio: number;
  if (tC >= 1) ratio = 0;
  else if (tC >= 0) ratio = 6;
  else if (tC >= -3) ratio = 10;
  else if (tC >= -8) ratio = 13;
  else if (tC >= -14) ratio = 17;
  else ratio = 13;
  return gustKmh > 40 ? ratio * 0.8 : ratio;
}
