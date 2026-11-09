import type { NextRequest } from "next/server";
import { getNationalSummary } from "@/lib/national/summary";
import { apiError, json, rateLimited } from "@/lib/server/api";

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  try {
    return json(await getNationalSummary(), { sMaxAge: 1800, swr: 3600 });
  } catch {
    return apiError("national_unavailable", "National snowfall data is temporarily unavailable.", 502);
  }
}
