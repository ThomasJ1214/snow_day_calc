import type { NextRequest } from "next/server";
import { getSchool } from "@/lib/schools/repo";
import { getSchoolPrediction } from "@/lib/forecast/school";
import { currentUser } from "@/lib/supabase/server";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { schoolIdSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const id = schoolIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return apiError("invalid_school", "Unknown school identifier.");
  const s = await getSchool(id.data).catch(() => null);
  if (!s?.value) return apiError("not_found", "School not found.", 404);
  // A calendar link is only ever taken from the signed-in user's saved settings (never from the URL).
  const me = await currentUser().catch(() => null);
  const userIcs = me ? ((await me.db.from("school_calendars").select("ics_url").eq("school_id", id.data).maybeSingle()).data?.ics_url ?? null) : null;
  const p = await getSchoolPrediction(s.value, { userIcs });
  if (!p.ok) return apiError(p.error.code, p.error.message, 502);
  return userIcs ? json(p.data) : json(p.data, { sMaxAge: 300, swr: 900 });
}
