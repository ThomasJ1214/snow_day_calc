import "server-only";
import type { NextRequest } from "next/server";

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". External schedulers must send the same header. */
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}
