import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";
import { adminClient } from "@/lib/supabase/admin";
import { SEED_HISTORY } from "./seed";
import { calibration, seasonCounts } from "./brier";
import type { OfficialStatus } from "@/lib/official/status";

export interface HistoryEvent {
  date: string;
  status: "closed" | "delayed";
  evidence: string;
  sourceUrl: string;
  origin: "district-archive" | "verifier";
}

export interface DistrictHistory {
  leaid: string;
  district: string;
  events: HistoryEvent[];
  seasons: { season: string; closed: number; delayed: number }[];
  calibration: { n: number; brier: number } | null;
  sources: string[];
}

export async function getDistrictHistory(leaid: string | null): Promise<DistrictHistory | null> {
  if (!leaid) return null;
  const seed = SEED_HISTORY[leaid];
  const events = new Map<string, HistoryEvent>();
  const sources: string[] = [];
  let district = seed?.district ?? "";
  if (seed) {
    sources.push(seed.source);
    for (const e of seed.events)
      events.set(`${e.date}:${e.status}`, { date: e.date, status: e.status, evidence: e.text, sourceUrl: seed.source.split(" ")[0], origin: "district-archive" });
  }
  let pairs: { p: number; o: 0 | 1 }[] = [];
  if (supabaseConfigured) {
    try {
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const [{ data: ev }, { data: preds }] = await Promise.all([
        db.from("closure_events").select("*").eq("leaid", leaid).order("school_day", { ascending: false }).limit(200),
        db.from("prediction_log").select("school_day, closure_pct").eq("leaid", leaid).limit(500),
      ]);
      for (const e of ev ?? []) {
        district ||= e.district;
        events.set(`${e.school_day}:${e.status}`, { date: e.school_day, status: e.status, evidence: e.evidence, sourceUrl: e.source_url, origin: e.origin });
      }
      if (ev?.length) sources.push("SnowDay verifier records");
      const closed = new Set((ev ?? []).filter((e) => e.status === "closed").map((e) => e.school_day));
      pairs = (preds ?? []).map((p) => ({ p: p.closure_pct / 100, o: closed.has(p.school_day) ? 1 : 0 }));
    } catch {
      /* history is optional */
    }
  }
  if (!events.size && !pairs.length) return null;
  const list = [...events.values()].sort((a, b) => b.date.localeCompare(a.date));
  return { leaid, district, events: list, seasons: seasonCounts(list), calibration: calibration(pairs), sources };
}

/** Persists a verified official closure/delay (service role). No-op when Supabase isn't configured. */
export async function recordOfficialEvent(leaid: string, district: string, schoolDay: string, s: OfficialStatus): Promise<void> {
  if (s.status !== "officially_closed" && s.status !== "officially_delayed") return;
  const db = adminClient();
  if (!db) return;
  await db.from("closure_events").upsert(
    {
      leaid,
      district,
      school_day: schoolDay,
      status: s.status === "officially_closed" ? "closed" : "delayed",
      source_url: s.sourceUrl ?? s.websiteUrl ?? "",
      evidence: s.headline.slice(0, 500),
      origin: "verifier",
      verified_at: s.verifiedAt,
    },
    { onConflict: "leaid,school_day,status", ignoreDuplicates: true },
  );
}

export async function recordPrediction(leaid: string, schoolDay: string, closurePct: number, delayPct: number): Promise<void> {
  const db = adminClient();
  if (!db) return;
  await db.from("prediction_log").upsert({ leaid, school_day: schoolDay, closure_pct: closurePct, delay_pct: delayPct }, { onConflict: "leaid,school_day" });
}
