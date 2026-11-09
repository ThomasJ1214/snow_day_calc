import type { NextRequest } from "next/server";
import { geocode } from "@/lib/geo/geocode";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { querySchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const q = querySchema.safeParse(req.nextUrl.searchParams.get("q") ?? "");
  if (!q.success) return apiError("invalid_query", "Enter a ZIP code, city and state, or street address.");
  const r = await geocode(q.data);
  if (!r.ok) return apiError(r.error.code, r.error.message, r.error.code === "invalid_query" ? 400 : 502);
  return json({ results: r.data }, { sMaxAge: 86_400, swr: 604_800 });
}
