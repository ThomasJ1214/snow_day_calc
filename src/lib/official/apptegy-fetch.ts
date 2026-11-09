import "server-only";
import { fetchJson } from "@/lib/server/http";
import type { ApptegyBanner, ApptegyEvent } from "./apptegy";

const CDN = "https://cmsv2-static-cdn-prod.apptegy.net/content";
const API = "https://thrillshare-cmsv2.services.thrillshare.com/api/v4/o";

export interface ApptegyConfig {
  parentOrgId: number;
  orgId: number;
}

export async function fetchApptegyBanners(c: ApptegyConfig): Promise<ApptegyBanner[]> {
  const d = await fetchJson<{ alert_banners?: ApptegyBanner[] }>(`${CDN}/${c.parentOrgId}/${c.orgId}/en/homepage_structure.json`, {
    revalidate: 120,
    timeoutMs: 8_000,
    retries: 0,
  });
  return d.alert_banners ?? [];
}

export async function fetchApptegyNews(c: ApptegyConfig): Promise<{ title: string; link: string; published_at: string; snippet?: string }[]> {
  const d = await fetchJson<{ articles?: { title: string; link: string; published_at: string; snippet?: string }[] }>(
    `${CDN}/${c.parentOrgId}/${c.orgId}/en/homepage_news.json`,
    { revalidate: 300, timeoutMs: 8_000, retries: 0 },
  );
  return d.articles ?? [];
}

export async function fetchApptegyEvents(c: ApptegyConfig, start: string, end: string): Promise<ApptegyEvent[]> {
  const d = await fetchJson<{ events?: ApptegyEvent[] }>(
    `${API}/${c.orgId}/cms/events?start_date=${start}&end_date=${end}&paginate=false&locale=en`,
    { revalidate: 21_600, timeoutMs: 10_000, retries: 0 },
  );
  return d.events ?? [];
}
