import type { NextRequest } from "next/server";
import { schoolsNear } from "@/lib/schools/repo";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { coordsSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const p = coordsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return apiError("invalid_coordinates", "Provide lat and lon within the United States.");
  try {
    const r = await schoolsNear(p.data.lat, p.data.lon, 8, 24);
    return json({ results: r.value, source: r.source }, { sMaxAge: 86_400, swr: 604_800 });
  } catch {
    return apiError("schools_unavailable", "The NCES school directory is temporarily unreachable.", 502);
  }
}
