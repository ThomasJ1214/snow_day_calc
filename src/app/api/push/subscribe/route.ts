import type { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/supabase/server";
import { apiError, json } from "@/lib/server/api";
import { pushConfigured } from "@/lib/push/send";

const sub = z.object({
  endpoint: z.string().url().max(2000).regex(/^https:\/\//),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function POST(req: NextRequest) {
  if (!pushConfigured) return apiError("push_not_configured", "Push notifications aren't configured on this deployment.", 503);
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in to enable notifications.", 401);
  const p = sub.safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError("invalid_subscription", "Invalid push subscription.");
  const { error } = await me.db.from("push_subscriptions").upsert(
    { user_id: me.user.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth, user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null },
    { onConflict: "endpoint" },
  );
  if (error) return apiError("save_failed", "Couldn't register this device.", 500);
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint) return apiError("invalid_request", "Missing endpoint.");
  await me.db.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return json({ ok: true });
}
