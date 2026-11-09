/**
 * Wet-bulb temperature from air temperature and relative humidity.
 * Stull (2011), "Wet-Bulb Temperature from Relative Humidity and Air Temperature",
 * J. Appl. Meteor. Climatol. Valid for RH 5–99% and T −20…50 °C; RH is clamped to that range.
 */
export function wetBulbC(tC: number, rhPct: number): number {
  const rh = Math.min(99, Math.max(5, rhPct));
  return (
    tC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}
