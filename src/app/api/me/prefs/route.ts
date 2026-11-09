import type { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/supabase/server";
import { apiError, json } from "@/lib/server/api";

const prefs = z.object({
  closure_threshold: z.number().int().min(10).max(100),
  snow_threshold_in: z.number().min(0.5).max(48),
  notify_official: z.boolean(),
  enabled: z.boolean(),
});
const DEFAULTS = { closure_threshold: 60, snow_threshold_in: 2, notify_official: true, enabled: true };

export async function GET() {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const { data } = await me.db.from("notification_prefs").select("*").maybeSingle();
  const { count } = await me.db.from("push_subscriptions").select("id", { count: "exact", head: true });
  return json({ prefs: data ?? DEFAULTS, devices: count ?? 0 });
}

export async function PUT(req: NextRequest) {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const p = prefs.safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError("invalid_body", "Invalid notification settings.");
  const { error } = await me.db.from("notification_prefs").upsert({ user_id: me.user.id, ...p.data, updated_at: new Date().toISOString() });
  if (error) return apiError("save_failed", "Couldn't save settings.", 500);
  return json({ ok: true });
}
