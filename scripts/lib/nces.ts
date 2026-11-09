/**
 * Shared NCES Common Core of Data helpers for the import/discovery scripts.
 * Downloads the CCD LEA (district) directory once into data/raw/ (git-ignored).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const CCD_LEA_URL =
  process.env.NCES_LEA_ZIP_URL ?? "https://nces.ed.gov/ccd/Data/zip/ccd_lea_029_2324_w_1a_073124.zip";
const RAW = path.join(__dirname, "../../data/raw");

export interface DistrictRow {
  leaid: string;
  name: string;
  state: string;
  city: string;
  zip: string;
  phone: string | null;
  website: string | null;
  leaType: string;
  operational: boolean;
}

/** Minimal RFC 4180 CSV parser (handles quoted fields with commas/quotes/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function normalizeWebsite(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  if (!v || v === "-1" || /^(m|n|na|none)$/i.test(v)) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function ensureLeaCsv(): Promise<string> {
  fs.mkdirSync(RAW, { recursive: true });
  const existing = fs.readdirSync(RAW).find((f) => /^ccd_lea_029.*\.csv$/i.test(f));
  if (existing) return path.join(RAW, existing);
  const zip = path.join(RAW, "lea.zip");
  console.log(`Downloading ${CCD_LEA_URL}`);
  const res = await fetch(CCD_LEA_URL);
  if (!res.ok) throw new Error(`NCES download failed: HTTP ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", zip, "-d", RAW]);
  const csv = fs.readdirSync(RAW).find((f) => /^ccd_lea_029.*\.csv$/i.test(f));
  if (!csv) throw new Error("CCD LEA CSV not found in archive");
  return path.join(RAW, csv);
}

export async function loadDistrictCsv(): Promise<DistrictRow[]> {
  const file = await ensureLeaCsv();
  const rows = parseCsv(fs.readFileSync(file, "latin1"));
  const header = rows[0];
  const col = (n: string) => header.indexOf(n);
  const idx = {
    leaid: col("LEAID"),
    name: col("LEA_NAME"),
    st: col("ST"),
    city: col("LCITY"),
    zip: col("LZIP"),
    phone: col("PHONE"),
    web: col("WEBSITE"),
    type: col("LEA_TYPE"),
    status: col("SY_STATUS"),
  };
  return rows
    .slice(1)
    .filter((r) => r.length > idx.leaid && r[idx.leaid])
    .map((r) => ({
      leaid: r[idx.leaid],
      name: r[idx.name],
      state: r[idx.st],
      city: r[idx.city],
      zip: r[idx.zip],
      phone: r[idx.phone] || null,
      website: normalizeWebsite(r[idx.web]),
      leaType: r[idx.type],
      operational: ["1", "3", "4", "5", "8"].includes(r[idx.status]),
    }));
}
