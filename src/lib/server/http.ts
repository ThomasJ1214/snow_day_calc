import "server-only";

export const USER_AGENT = `SnowDay/1.0 (+${process.env.NEXT_PUBLIC_SITE_URL ?? "https://github.com/ThomasJ1214/snow_day_calc"}; ${process.env.NWS_CONTACT_EMAIL ?? "contact via repository"})`;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** fetch with a timeout, a descriptive User-Agent and one retry on network errors / 5xx. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number; revalidate?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, retries = 1, revalidate, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        signal: ctrl.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json, application/xml, text/xml, */*", ...(rest.headers ?? {}) },
        ...(revalidate != null ? { next: { revalidate } } : {}),
      });
      if (res.status >= 500 && attempt < retries) {
        lastErr = new HttpError(res.status, `HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T>(url: string, init?: Parameters<typeof fetchWithTimeout>[1]): Promise<T> {
  const res = await fetchWithTimeout(url, init);
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}
