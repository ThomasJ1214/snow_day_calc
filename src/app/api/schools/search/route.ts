import type { NextRequest } from "next/server";
import { z } from "zod";
import { searchSchools } from "@/lib/schools/repo";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { latSchema, lonSchema, querySchema, stateSchema, zipSchema } from "@/lib/server/schemas";

const schema = z.object({
  q: querySchema.optional(),
  state: stateSchema.optional(),
  zip: zipSchema.optional(),
  lat: latSchema.optional(),
  lon: lonSchema.optional(),
});

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const raw = Object.fromEntries([...req.nextUrl.searchParams].filter(([, v]) => v !== ""));
  if (raw.q && /^\d{5}$/.test(raw.q.trim())) {
    raw.zip = raw.q.trim();
    delete raw.q;
  }
  const p = schema.safeParse(raw);
  if (!p.success || (!p.data.q && !p.data.zip)) return apiError("invalid_query", "Search by school name, district, city, or 5-digit ZIP code.");
  const near = p.data.lat != null && p.data.lon != null ? { lat: p.data.lat, lon: p.data.lon } : undefined;
  try {
    const r = await searchSchools({ q: p.data.q, state: p.data.state, zip: p.data.zip, near, limit: 25 });
    return json({ results: r.value, source: r.source }, { sMaxAge: 3600, swr: 86_400 });
  } catch {
    return apiError("schools_unavailable", "The NCES school directory is temporarily unreachable. Please try again shortly.", 502);
  }
}
