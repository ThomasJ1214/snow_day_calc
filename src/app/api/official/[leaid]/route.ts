import type { NextRequest } from "next/server";
import { verifyDistrict } from "@/lib/official/verify";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { leaidSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest, ctx: { params: Promise<{ leaid: string }> }) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const id = leaidSchema.safeParse((await ctx.params).leaid);
  if (!id.success) return apiError("invalid_district", "District IDs are 7-digit NCES LEA IDs.");
  return json(await verifyDistrict(id.data, null), { sMaxAge: 120, swr: 300 });
}
