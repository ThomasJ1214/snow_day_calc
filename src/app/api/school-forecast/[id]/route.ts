import type { NextRequest } from "next/server";
import { getSchool } from "@/lib/schools/repo";
import { getSchoolPrediction } from "@/lib/forecast/school";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { schoolIdSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const id = schoolIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return apiError("invalid_school", "Unknown school identifier.");
  const s = await getSchool(id.data).catch(() => null);
  if (!s?.value) return apiError("not_found", "School not found.", 404);
  const ics = req.nextUrl.searchParams.get("ics");
  const p = await getSchoolPrediction(s.value, { userIcs: ics && /^https:\/\/[^\s]{5,990}$/.test(ics) ? ics : null });
  if (!p.ok) return apiError(p.error.code, p.error.message, 502);
  return json(p.data, { sMaxAge: ics ? 0 : 300, swr: 900 });
}
