import { describe, expect, it } from "vitest";
import { isPublicHttpsUrl } from "../url-guard";

describe("isPublicHttpsUrl (SSRF guard for user-supplied calendar links)", () => {
  it.each(["https://www.montville.net/calendar.ics", "https://calendar.google.com/calendar/ical/x/basic.ics"])("allows %s", (u) => expect(isPublicHttpsUrl(u)).toBe(true));
  it.each([
    "http://example.com/a.ics",
    "https://localhost/a.ics",
    "https://127.0.0.1/a.ics",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.5/a.ics",
    "https://[::1]/a.ics",
    "https://metadata.google.internal/x",
    "https://printer.local/x",
    "https://user:pass@example.com/a.ics",
    "https://example.com:8443/a.ics",
    "not a url",
  ])("rejects %s", (u) => expect(isPublicHttpsUrl(u)).toBe(false));
});
