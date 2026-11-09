// Screenshots key pages at phone and desktop widths and reports console errors / horizontal overflow.
// Usage: start the site (npm run dev or npm start), then: npm run smoke:ui  [BASE_URL=http://localhost:3000]
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright isn't installed. Run: npx playwright install chromium && npm i -D playwright");
  process.exit(1);
}
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = [
  ["home", "/"],
  ["forecast-montville", "/forecast/montville-nj--40.9154_-74.3638"],
  ["school-mths", "/school/pub-341065004332"],
  ["national", "/national"],
  ["compare", "/compare?l=montville-nj--40.9154_-74.3638,morristown-nj--40.7968_-74.4815"],
  ["methodology", "/methodology"],
];
fs.mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch();
let problems = 0;
for (const [w, h, tag] of [[390, 844, "phone"], [1440, 900, "desktop"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  for (const [name, path] of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !m.text().includes("_rsc") && errors.push(m.text()));
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(12000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: `screenshots/${name}-${tag}.png`, fullPage: true });
    const bad = overflow > 0 || errors.length > 0;
    problems += bad ? 1 : 0;
    console.log(`${bad ? "✗" : "✓"} ${name} (${tag}) overflow=${overflow}px errors=${errors.length}${errors.length ? ` — ${errors[0].slice(0, 120)}` : ""}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
process.exit(problems ? 1 : 0);
