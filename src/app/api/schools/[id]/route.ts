import type { NextRequest } from "next/server";
import { getSchool } from "@/lib/schools/repo";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { schoolIdSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const id = schoolIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return apiError("invalid_school", "Unknown school identifier.");
  const r = await getSchool(id.data).catch(() => null);
  if (!r) return apiError("schools_unavailable", "The school directory is temporarily unreachable.", 502);
  if (!r.value) return apiError("not_found", "No NCES school matches that identifier.", 404);
  return json({ school: r.value }, { sMaxAge: 86_400, swr: 604_800 });
}
