/**
 * Accepts only https URLs on the default port pointing at a public DNS hostname. Rejects IP literals,
 * localhost, internal/link-local names and embedded credentials (server-side request forgery guard).
 */
export function isPublicHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host) || /^[0-9a-f:]+$/.test(host)) return false;
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) return false;
  return true;
}
