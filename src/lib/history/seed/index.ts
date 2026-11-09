import montville from "./3410650.json";

export interface SeedHistory {
  leaid: string;
  district: string;
  source: string;
  extractedAt: string;
  note: string;
  events: { date: string; status: "closed" | "delayed"; text: string; bannerId: number }[];
}

/** Verified closure histories extracted from districts' own official announcements (scripts/apptegy-history.ts). */
export const SEED_HISTORY: Record<string, SeedHistory> = {
  "3410650": montville as SeedHistory,
};
