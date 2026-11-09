import { describe, expect, it } from "vitest";
import { classifyAnnouncement, resolveStatus, parseFeed } from "../status";

const now = new Date("2026-12-08T11:00:00Z");
const entry = { leaid: "2503270", name: "Test District", feeds: [{ type: "rss" as const, url: "https://example.org/feed" }] };

describe("classifyAnnouncement", () => {
  it.each([
    ["Schools closed Tuesday due to snow", "closed"],
    ["All CPS schools will be CLOSED today, Dec. 8", "closed"],
    ["No school Monday, February 2 — snow day", "closed"],
    ["Snow day: district offices and schools are closed", "closed"],
    ["Inclement weather: remote learning day for all students", "closed"],
    ["2-hour delay for all schools", "delayed"],
    ["Two hour delayed opening Wednesday", "delayed"],
    ["Schools will open 90 minutes late", "delayed"],
  ])("%s → %s", (text, expected) => expect(classifyAnnouncement(text)).toBe(expected));

  it.each([
    "No delay — schools will open on time",
    "Schools are open today; no closures",
    "Schools will not be closed tomorrow",
    "Winter break: schools closed Dec 22 – Jan 2",
    "Board meeting delayed to Thursday",
    "Thanksgiving recess, schools closed",
    "Parking lot closed for repaving",
  ])("does not classify '%s'", (text) => expect(classifyAnnouncement(text)).toBeNull());
});

describe("resolveStatus", () => {
  it("is unavailable when the district has no registry entry", () => {
    const s = resolveStatus({ registryEntry: null, items: [], now, websiteUrl: "https://district.example" });
    expect(s.status).toBe("unavailable");
    expect(s.websiteUrl).toBe("https://district.example");
  });

  it("is no_cancellation_announced when the feed has nothing recent and relevant", () => {
    const s = resolveStatus({
      registryEntry: entry,
      items: [{ title: "Spring musical tickets", link: "https://x/1", published: "2026-12-08T09:00:00Z" }],
      now,
      websiteUrl: null,
    });
    expect(s.status).toBe("no_cancellation_announced");
    expect(s.sourceUrl).toBe("https://example.org/feed");
  });

  it("reports an official closure with evidence", () => {
    const s = resolveStatus({
      registryEntry: entry,
      items: [{ title: "Schools closed Tuesday due to snow", link: "https://x/2", published: "2026-12-08T10:30:00Z" }],
      now,
      websiteUrl: null,
    });
    expect(s.status).toBe("officially_closed");
    expect(s.evidence?.link).toBe("https://x/2");
    expect(s.verifiedAt).toBe(now.toISOString());
  });

  it("ignores announcements older than 18 hours", () => {
    const s = resolveStatus({
      registryEntry: entry,
      items: [{ title: "Schools closed due to snow", link: "https://x/3", published: "2026-12-07T14:00:00Z" }],
      now,
      websiteUrl: null,
    });
    expect(s.status).toBe("no_cancellation_announced");
  });

  it("prefers closure over delay when both are present", () => {
    const s = resolveStatus({
      registryEntry: entry,
      items: [
        { title: "2-hour delay for all schools", link: "https://x/4", published: "2026-12-08T09:00:00Z" },
        { title: "UPDATE: schools are now closed today", link: "https://x/5", published: "2026-12-08T10:00:00Z" },
      ],
      now,
      websiteUrl: null,
    });
    expect(s.status).toBe("officially_closed");
  });
});

describe("parseFeed", () => {
  it("parses RSS 2.0 items", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title>Schools Closed</title><link>https://a/1</link><pubDate>Tue, 08 Dec 2026 10:00:00 GMT</pubDate><description>Snow</description></item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Schools Closed");
    expect(items[0].published).toBe("2026-12-08T10:00:00.000Z");
  });
  it("parses Atom entries", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Delay</title><link href="https://a/2"/><updated>2026-12-08T10:00:00Z</updated></entry></feed>`;
    const items = parseFeed(xml);
    expect(items[0].link).toBe("https://a/2");
  });
  it("returns [] for malformed input", () => expect(parseFeed("not xml <<<")).toEqual([]));
});
