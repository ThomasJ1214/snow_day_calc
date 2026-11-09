import "server-only";
import { fetchWithTimeout } from "@/lib/server/http";
import { decodeGrib2Message, valueAt, type Grib2Field } from "@/lib/grib2/decode";
import { fail, ok, type Result } from "./types";

/**
 * Direct ingestion of NOAA HRRR GRIB2 from the NOAA Open Data Dissemination bucket.
 * Only the needed fields are downloaded, via HTTP range requests located with the .idx index.
 */
const BUCKET = "https://noaa-hrrr-bdp-pds.s3.amazonaws.com";
const RRFS_BUCKET = "https://noaa-rrfs-pds.s3.amazonaws.com";
const LEADS = [6, 12, 18] as const;
type Lead = (typeof LEADS)[number];

export interface HrrrPoint {
  run: string;
  runTime: string;
  /** Accumulated snowfall from run start to +N h at the nearest 3 km grid cell (cm). */
  asnowCm: Record<Lead, number | null>;
  rrfsStatus: "not_published" | "available";
}

export interface RunGrids {
  run: string;
  runTime: Date;
  fields: Partial<Record<Lead, Grib2Field>>;
  at: number;
}

let current: RunGrids | null = null;
let inflight: Promise<RunGrids> | null = null;
let rrfsChecked: { at: number; status: HrrrPoint["rrfsStatus"] } | null = null;

const pad = (n: number) => String(n).padStart(2, "0");
const fileUrl = (d: Date, lead: number) =>
  `${BUCKET}/hrrr.${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}/conus/hrrr.t${pad(d.getUTCHours())}z.wrfsfcf${pad(lead)}.grib2`;

/** Byte range of the "ASNOW:surface:0-N hour acc" message from an HRRR .idx file. */
export function asnowRange(idx: string, lead: number): { start: number; end: number | null } | null {
  const lines = idx.trim().split("\n");
  for (let k = 0; k < lines.length; k++) {
    const parts = lines[k].split(":");
    if (parts[3] === "ASNOW" && parts[4] === "surface" && parts[5] === `0-${lead} hour acc fcst`) {
      const start = Number(parts[1]);
      const next = lines[k + 1]?.split(":")[1];
      return { start, end: next ? Number(next) - 1 : null };
    }
  }
  return null;
}

async function latestRun(): Promise<Date> {
  const now = Date.now();
  for (let back = 1; back <= 6; back++) {
    const d = new Date(now - back * 3_600_000);
    d.setUTCMinutes(0, 0, 0);
    const res = await fetchWithTimeout(`${fileUrl(d, 18)}.idx`, { method: "HEAD", timeoutMs: 5_000, retries: 0 });
    if (res.ok) return d;
  }
  throw new Error("No complete HRRR run found in the last 6 hours");
}

async function loadField(run: Date, lead: Lead): Promise<Grib2Field | undefined> {
  const idxRes = await fetchWithTimeout(`${fileUrl(run, lead)}.idx`, { timeoutMs: 8_000, retries: 1 });
  if (!idxRes.ok) return undefined;
  const range = asnowRange(await idxRes.text(), lead);
  if (!range) return undefined;
  const res = await fetchWithTimeout(fileUrl(run, lead), {
    timeoutMs: 20_000,
    retries: 1,
    headers: { Range: `bytes=${range.start}-${range.end ?? ""}` },
  });
  if (!res.ok && res.status !== 206) return undefined;
  return decodeGrib2Message(new Uint8Array(await res.arrayBuffer()));
}

async function loadRun(): Promise<RunGrids> {
  const run = await latestRun();
  const label = `${run.toISOString().slice(0, 10)} ${pad(run.getUTCHours())}Z`;
  if (current && current.run === label) return current;
  const fields: RunGrids["fields"] = {};
  await Promise.all(
    LEADS.map(async (lead) => {
      fields[lead] = await loadField(run, lead).catch(() => undefined);
    }),
  );
  current = { run: label, runTime: run, fields, at: Date.now() };
  return current;
}

async function rrfsStatus(): Promise<HrrrPoint["rrfsStatus"]> {
  if (rrfsChecked && Date.now() - rrfsChecked.at < 6 * 3_600_000) return rrfsChecked.status;
  let status: HrrrPoint["rrfsStatus"] = "not_published";
  try {
    const res = await fetchWithTimeout(`${RRFS_BUCKET}/?list-type=2&prefix=rrfs_a/rrfs.&max-keys=1`, { timeoutMs: 5_000, retries: 0 });
    if (res.ok && /<KeyCount>[1-9]/.test(await res.text())) status = "available";
  } catch {
    /* treated as not published */
  }
  rrfsChecked = { at: Date.now(), status };
  return status;
}

/** Latest decoded HRRR 0–6/12/18 h snowfall grids (shared with the national map renderer). */
export async function getHrrrGrids(): Promise<RunGrids> {
  if (!current || Date.now() - current.at > 20 * 60_000) {
    inflight ??= loadRun().finally(() => {
      inflight = null;
    });
    await inflight;
  }
  return current!;
}

export async function fetchHrrrPoint(lat: number, lon: number): Promise<Result<HrrrPoint>> {
  try {
    if (!current || Date.now() - current.at > 20 * 60_000) {
      inflight ??= loadRun().finally(() => {
        inflight = null;
      });
      await inflight;
    }
    const grids = current!;
    const asnowCm = {} as Record<Lead, number | null>;
    let inside = false;
    for (const lead of LEADS) {
      const f = grids.fields[lead];
      const v = f ? valueAt(f, lat, lon) : NaN;
      if (Number.isFinite(v)) inside = true;
      asnowCm[lead] = Number.isFinite(v) ? Math.round(v * 1000) / 10 : null;
    }
    if (!inside && Object.keys(grids.fields).length > 0) return fail("outside_domain", "Outside the HRRR CONUS domain (Alaska, Hawaii and territories are not covered).");
    if (!inside) return fail("hrrr_unavailable", "HRRR GRIB2 fields could not be retrieved from NOAA right now.");
    return ok({ run: grids.run, runTime: grids.runTime.toISOString(), asnowCm, rrfsStatus: await rrfsStatus() });
  } catch (e) {
    return fail("hrrr_unavailable", `HRRR direct ingestion unavailable (${e instanceof Error ? e.message : e}).`);
  }
}
