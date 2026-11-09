import type { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/supabase/server";
import { apiError, json, rateLimited } from "@/lib/server/api";
import { latSchema, lonSchema, schoolIdSchema } from "@/lib/server/schemas";

const location = z.object({ type: z.literal("location"), name: z.string().trim().min(1).max(120), lat: latSchema, lon: lonSchema });
const school = z.object({
  type: z.literal("school"),
  schoolId: schoolIdSchema,
  name: z.string().trim().min(1).max(160),
  leaid: z.string().regex(/^\d{7}$/).nullable().optional(),
  lat: latSchema,
  lon: lonSchema,
});
const item = z.discriminatedUnion("type", [location, school]);
const body = z.object({ items: z.array(item).max(100) });

export async function GET() {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in to sync favorites.", 401);
  const [l, s] = await Promise.all([
    me.db.from("saved_locations").select("id, name, lat, lon, created_at").order("created_at"),
    me.db.from("saved_schools").select("id, school_id, school_name, leaid, lat, lon, created_at").order("created_at"),
  ]);
  return json({ locations: l.data ?? [], schools: s.data ?? [] });
}

/** Upserts favorites (used for adding one item and for merging local favorites after sign-in). */
export async function POST(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in to sync favorites.", 401);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError("invalid_body", "Invalid favorites payload.");
  const locs = p.data.items.filter((i) => i.type === "location").map((i) => ({ user_id: me.user.id, name: i.name, lat: i.lat, lon: i.lon }));
  const schools = p.data.items
    .filter((i): i is z.infer<typeof school> => i.type === "school")
    .map((i) => ({ user_id: me.user.id, school_id: i.schoolId, school_name: i.name, leaid: i.leaid ?? null, lat: i.lat, lon: i.lon }));
  const results = await Promise.all([
    locs.length ? me.db.from("saved_locations").upsert(locs, { onConflict: "user_id,lat,lon", ignoreDuplicates: true }) : null,
    schools.length ? me.db.from("saved_schools").upsert(schools, { onConflict: "user_id,school_id", ignoreDuplicates: true }) : null,
  ]);
  const err = results.find((r) => r?.error)?.error;
  if (err) return apiError("save_failed", "Couldn't save favorites. Please try again.", 500);
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const kind = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (kind === "school" && schoolIdSchema.safeParse(id).success) await me.db.from("saved_schools").delete().eq("school_id", id);
  else if (kind === "location") {
    const lat = latSchema.safeParse(req.nextUrl.searchParams.get("lat"));
    const lon = lonSchema.safeParse(req.nextUrl.searchParams.get("lon"));
    if (!lat.success || !lon.success) return apiError("invalid_request", "Specify lat and lon of the saved place.");
    // Saved coordinates may carry more decimals than the client sends; match within ~10 m.
    await me.db.from("saved_locations").delete().gte("lat", lat.data - 1e-4).lte("lat", lat.data + 1e-4).gte("lon", lon.data - 1e-4).lte("lon", lon.data + 1e-4);
  } else return apiError("invalid_request", "Specify type=school (with id) or type=location (with lat and lon).");
  return json({ ok: true });
}
