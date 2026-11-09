import { currentUser } from "@/lib/supabase/server";
import { apiError, json } from "@/lib/server/api";
import { pushConfigured, sendPush } from "@/lib/push/send";

/** Sends a test notification to the signed-in user's devices. */
export async function POST() {
  if (!pushConfigured) return apiError("push_not_configured", "Push notifications aren't configured on this deployment.", 503);
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const { data } = await me.db.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (!data?.length) return apiError("no_devices", "Enable notifications on this device first.");
  const results = await Promise.all(data.map((s) => sendPush(s, { title: "SnowDay notifications are on", body: "You'll hear from us when your school is likely to close or an official closure is posted.", url: "/account" })));
  return json({ sent: results.filter((r) => r === "ok").length });
}
