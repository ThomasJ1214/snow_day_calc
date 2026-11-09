import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";

/** OAuth (Google) PKCE callback: exchanges the code for a session cookie. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const db = await serverClient();
  if (db && code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(`${safeNext}${safeNext.includes("?") ? "&" : "?"}welcome=1`, req.url));
  }
  return NextResponse.redirect(new URL("/signin?error=oauth", req.url));
}
