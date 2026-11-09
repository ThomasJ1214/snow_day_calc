import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "./rate-limit";

const limiter = createRateLimiter({ capacity: 60, refillPerSec: 1 });

export function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}

export function rateLimited(req: NextRequest): NextResponse | null {
  if (limiter(clientKey(req))) return null;
  return NextResponse.json({ error: { code: "rate_limited", message: "Too many requests — please wait a moment and try again." } }, { status: 429, headers: { "Retry-After": "10" } });
}

export function json<T>(data: T, opts: { sMaxAge?: number; swr?: number; status?: number } = {}): NextResponse {
  const { sMaxAge = 0, swr = 0, status = 200 } = opts;
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": sMaxAge ? `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` : "no-store" },
  });
}

export function apiError(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
