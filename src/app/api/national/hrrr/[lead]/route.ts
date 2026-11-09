import type { NextRequest } from "next/server";
import { renderHrrrOverlay } from "@/lib/national/hrrr-overlay";
import { apiError } from "@/lib/server/api";

export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ lead: string }> }) {
  const lead = Number((await ctx.params).lead);
  if (lead !== 6 && lead !== 12 && lead !== 18) return apiError("invalid_lead", "Lead must be 6, 12 or 18 hours.");
  try {
    const r = await renderHrrrOverlay(lead);
    if (!r) return apiError("hrrr_unavailable", "HRRR data is not available right now.", 503);
    return new Response(new Uint8Array(r.png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        "X-HRRR-Run": r.run,
      },
    });
  } catch {
    return apiError("hrrr_unavailable", "HRRR data is not available right now.", 503);
  }
}
