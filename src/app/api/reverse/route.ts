import type { NextRequest } from "next/server";
import { reverseGeocode } from "@/lib/geo/geocode";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { coordsSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const p = coordsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return apiError("invalid_coordinates", "That point is outside the United States.");
  return json({ place: await reverseGeocode(p.data.lat, p.data.lon) }, { sMaxAge: 86_400, swr: 604_800 });
}
