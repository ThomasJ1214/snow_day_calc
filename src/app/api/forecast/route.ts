import type { NextRequest } from "next/server";
import { getLocationForecast } from "@/lib/forecast/service";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { coordsSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const p = coordsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return apiError("invalid_coordinates", "Provide lat and lon within the United States.");
  const f = await getLocationForecast(p.data.lat, p.data.lon);
  if (!f.ok) return apiError(f.error.code, f.error.message, 502);
  return json(f.data, { sMaxAge: 600, swr: 1800 });
}
