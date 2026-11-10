# Launch Snow Day Scout on Google: domain, indexing and SEO

This guide takes the site from "deployed on Vercel" to "showing up when Montville parents google *snow day tomorrow*". Do the steps in order. Total hands-on time is about an hour; Google takes a few days to a few weeks to start ranking a new site, so **do this before the first real storm**.

---

## 1. Buy the domain (5 minutes)

**snowdayscout.com** was available at about $12/year when this was written.

- Easiest: Vercel → **Domains → Buy**, and search `snowdayscout.com`. Buying it in Vercel means DNS is configured for you.
- Or use any registrar (Cloudflare Registrar, Porkbun, Namecheap). Avoid add-ons such as "SEO packages" or "premium DNS"; you don't need them.

## 2. Point it at the site (10 minutes)

1. Vercel → your project → **Settings → Domains → Add** `snowdayscout.com`, then add `www.snowdayscout.com` and choose **Redirect to snowdayscout.com**. One address only: Google treats `www` and non-`www` as different sites.
2. If you bought the domain elsewhere, add the DNS records Vercel shows at your registrar (an `A` record to `76.76.21.21` for the bare domain, a `CNAME` to `cname.vercel-dns.com` for `www`). HTTPS turns on by itself.
3. Vercel → **Settings → Environment Variables**: set `NEXT_PUBLIC_SITE_URL` = `https://snowdayscout.com` (no trailing slash), then **Deployments → ⋯ → Redeploy**. Every canonical link, share image, sitemap and `robots.txt` entry is built from this value, so this step matters for SEO.
4. Supabase → **Authentication → URL Configuration**:
   - Set **Site URL** to `https://snowdayscout.com`.
   - Add `https://snowdayscout.com/auth/callback` to **Redirect URLs**.
5. Google Cloud console (the OAuth client used for "Continue with Google"): add `https://snowdayscout.com` to **Authorized JavaScript origins**.

Check: open `https://snowdayscout.com/robots.txt` and `https://snowdayscout.com/sitemap.xml`. Both should list `https://snowdayscout.com/...` addresses, not `localhost` or `vercel.app`.

## 3. Tell Google the site exists: Search Console (15 minutes)

1. Go to <https://search.google.com/search-console> and sign in with the Google account you want to own the site.
2. **Add property → Domain** (the left option), and enter `snowdayscout.com`.
3. Google shows a **TXT record** (`google-site-verification=...`). Add it as a DNS record:
   - **Vercel DNS:** Vercel → **Domains** → `snowdayscout.com` → **DNS Records → Add**, with Type `TXT`, Name `@`, and the value Google gave you.
   - **Another registrar:** add the same record in that registrar's DNS panel.
4. Back in Search Console, press **Verify**. It can take a few minutes; if it fails, wait 10 minutes and retry.
5. **Sitemaps** (left menu): enter `sitemap.xml` and press **Submit**. The sitemap lists the home page, the Montville pages, a forecast page for every reference city, and every school within about 25 km of Montville.
6. **URL inspection** (top search bar): paste each of these, wait for the result, then press **Request indexing**:
   - `https://snowdayscout.com/`
   - `https://snowdayscout.com/school/pub-341065004332` (Montville Township High School)
   - `https://snowdayscout.com/forecast/montville-nj--40.9154_-74.3638`

## 4. Bing too (5 minutes, worth it)

Bing's index also feeds DuckDuckGo, Yahoo, and the web search used by ChatGPT and Copilot.

1. Go to <https://www.bing.com/webmasters>.
2. Choose **Import from Google Search Console**. It copies your verified site and sitemap in one click.

## 5. What is already built into the site

You don't need to add any of this; it's listed so you know what Google sees.

- **Titles and descriptions:**
  - Home: "Snow Day Scout: Snow Day Predictor & Snowfall Forecast".
  - Every school page: "[School] snow day prediction".
  - Every forecast page: its own title too.
- **Branded share images** for the home page, every school and every forecast, so links shared in group chats and Facebook show the live numbers.
- **Canonical URLs** (no duplicate-page penalties).
- **Structured data:** `WebSite` and `WebApplication` JSON-LD.
- **Sitemaps and crawl rules:** `sitemap.xml` and `robots.txt`. Private pages (`/account`, the API) are excluded.
- **Speed and accessibility:**
  - Lighthouse scores 100 for SEO, accessibility and best practices.
  - Server-rendered school headers.
  - No layout shift.

## 6. Get found by Montville families (the part that actually moves rankings)

A brand-new domain ranks on **links and real visits**. For a local tool, the fastest wins are local:

1. **Post it where parents already talk, the night a storm is forecast.** That is exactly when people search "Montville snow day".
   - Montville Facebook parent groups and Moms/Dads groups.
   - Nextdoor (Montville, Pine Brook, Towaco).
   - PTO/PTA newsletters for each school.
   - Post a link to the **Montville Township High School page**, because its share image shows the live odds.
2. **Ask for real links.** A link from a local site is worth more than dozens of random ones. Good targets:
   - **Montville Patch.** Send a tip with "local student/resident built a free snow-day predictor".
   - Montville Township High School's student newspaper.
   - The PTO websites.
   - Local news on TAPinto Montville.
   - r/newjersey on a storm night.
3. **Use the words people type.** Popular searches include:
   - "snow day calculator" and "snow day predictor".
   - "will school close tomorrow".
   - "Montville snow day" and "Montville schools closed".

   Use these phrases naturally when you post.
4. **Keep it accurate.** The site already separates predictions from official announcements and records how it did. If people trust it after one storm, they bookmark it and come back; repeat visits are the strongest signal there is.

## 7. Watch it work

- **Search Console → Performance** (check weekly) shows which searches show your site, how often, and the clicks.
  - Expect almost nothing for the first one or two weeks, then a jump around the first storm.
- **Search Console → Pages** shows which pages Google indexed and why any were skipped.
- **Optional visitor counts:** Vercel → your project → **Analytics → Enable**. It's free on the Hobby plan and cookie-free, so no consent banner is needed.

## Don't

- Don't buy backlinks or "SEO services" that promise page one. They get new sites penalized.
- Don't create hundreds of copy-paste pages ("Snow day [every town]"). The city and school pages already carry real, different data for each place.
- Don't change the domain later. Every link and ranking you earn is tied to it.
