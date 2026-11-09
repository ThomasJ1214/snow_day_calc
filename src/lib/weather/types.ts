/** One forecast source (a deterministic model or one ensemble member), hourly, in the location's local time. */
export interface HourlySeries {
  /** Local wall-clock times "YYYY-MM-DDTHH:mm" (no offset) in the location's IANA timezone. */
  time: string[];
  precipMm: (number | null)[];
  /** Model-reported snowfall, cm (Open-Meteo `snowfall`). */
  snowfallCm: (number | null)[];
  tempC: (number | null)[];
  rh: (number | null)[];
  gustKmh: (number | null)[];
  windKmh: (number | null)[];
  visibilityM: (number | null)[];
  weatherCode: (number | null)[];
  freezingLevelM?: (number | null)[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = never>(code: string, message: string): Result<T> => ({ ok: false, error: { code, message } });
