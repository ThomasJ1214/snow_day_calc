import type { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/supabase/server";
import { apiError, json } from "@/lib/server/api";
import { schoolIdSchema } from "@/lib/server/schemas";
import { fetchWithTimeout } from "@/lib/server/http";
import { parseNoSchoolDays } from "@/lib/calendar/ics";

const body = z.object({ schoolId: schoolIdSchema, icsUrl: z.string().trim().url().max(1000).regex(/^https:\/\//) });

export async function GET() {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const { data } = await me.db.from("school_calendars").select("school_id, ics_url");
  return json({ calendars: data ?? [] });
}

/** Attaches a school calendar (.ics) after confirming it parses and contains no-school days. */
export async function POST(req: NextRequest) {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError("invalid_body", "Enter an https:// link to an iCalendar (.ics) feed.");
  let days = 0;
  try {
    const res = await fetchWithTimeout(p.data.icsUrl.replace(/^webcal:/, "https:"), { timeoutMs: 8_000, retries: 0 });
    const text = res.ok ? await res.text() : "";
    if (!text.includes("BEGIN:VCALENDAR")) return apiError("not_ics", "That link didn't return an iCalendar file.");
    days = parseNoSchoolDays(text).length;
  } catch {
    return apiError("unreachable", "Couldn't download that calendar. Check the link and try again.");
  }
  const { error } = await me.db.from("school_calendars").upsert({ user_id: me.user.id, school_id: p.data.schoolId, ics_url: p.data.icsUrl }, { onConflict: "user_id,school_id" });
  if (error) return apiError("save_failed", "Couldn't save the calendar.", 500);
  return json({ ok: true, noSchoolDays: days });
}

export async function DELETE(req: NextRequest) {
  const me = await currentUser();
  if (!me) return apiError("unauthorized", "Sign in first.", 401);
  const id = schoolIdSchema.safeParse(req.nextUrl.searchParams.get("schoolId"));
  if (!id.success) return apiError("invalid_request", "Missing schoolId.");
  await me.db.from("school_calendars").delete().eq("school_id", id.data);
  return json({ ok: true });
}
