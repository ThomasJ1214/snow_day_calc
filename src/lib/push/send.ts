import "server-only";
import webpush from "web-push";

export const pushConfigured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
let ready = false;

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one Web Push message. Returns "gone" when the subscription has expired (HTTP 404/410). */
export async function sendPush(sub: StoredSubscription, payload: { title: string; body: string; url: string; tag?: string }): Promise<"ok" | "gone" | "error"> {
  if (!pushConfigured) return "error";
  if (!ready) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    ready = true;
  }
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "high" });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "error";
  }
}
