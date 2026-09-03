# The Bowen Realty Group — landing page

A single-page site for Jeffrey Bowen, broker associate at eRealty Advisors,
covering Chelsea, East Boston, Everett and Malden.

Plain HTML, CSS and JavaScript in one file. No build step, no framework, no
server. Two sections pull live data from JSON files that small Node scripts
regenerate.

```
index.html          the whole site — markup, styles and scripts
listings.json       active listings + recent sales, from Zillow
videos.json         latest YouTube uploads
robots.txt          crawl rules
sitemap.xml         one entry; submit to Search Console after the domain swap
heatshot.jpeg       hero portrait
jeffrey-about.jpg   About section photo
scripts/            the two data fetchers
.github/workflows/  scheduled refreshes
```

---

## Commands

Everything runs through npm. Node 18+ (Node 20+ if you need the browser
fallback described below).

| Command | What it does |
| --- | --- |
| `npm install` | Installs Playwright, the only dependency. Needed **once**, and only for the Zillow browser fallback. |
| `npx playwright install chromium` | Downloads the browser that fallback drives. Also once, after `npm install`. |
| `npm run listings` | Fetches Zillow → rewrites `listings.json`. |
| `npm run listings:browser` | Same, skipping straight to the headless browser. |
| `npm run videos` | Fetches the YouTube feed → rewrites `videos.json`. |
| `npm run refresh` | Both of the above, listings first. |
| `npm run serve` | Serves the folder at `http://localhost:3000` for previewing. |

**Preview through `npm run serve`, not by double-clicking `index.html`.** The
page fetches its JSON over XHR, which `file://` blocks — open it off the
filesystem and both data sections fall back to "view on Zillow" links.

### The underlying scripts

The npm scripts are thin wrappers. Call the scripts directly when you want
their flags:

```bash
# Listings — scripts/fetch-listings.mjs
node scripts/fetch-listings.mjs                      # hardened HTTP, then browser
node scripts/fetch-listings.mjs --browser            # skip to the browser
node scripts/fetch-listings.mjs --no-browser         # HTTP only, fail if blocked
node scripts/fetch-listings.mjs --months 12          # widen the sold window (default 6)
node scripts/fetch-listings.mjs --out ./listings.json
node scripts/fetch-listings.mjs --profile https://www.zillow.com/profile/SomeoneElse
node scripts/fetch-listings.mjs --from-html saved.html    # parse a saved page, offline

# Videos — scripts/fetch-videos.mjs
node scripts/fetch-videos.mjs                        # newest 6
node scripts/fetch-videos.mjs --limit 8              # show more
node scripts/fetch-videos.mjs --channel UCxxxxxxxx   # a different channel
node scripts/fetch-videos.mjs --out ./videos.json
node scripts/fetch-videos.mjs --from-xml saved.xml   # parse a saved feed, offline
```

Both scripts fail safe: on **any** error they exit non-zero and leave the
existing JSON untouched, so a bad fetch is a stale section, never an empty one.
Both write atomically, so the site never reads a half-written file.

---

## Where the data comes from

### Listings — `scripts/fetch-listings.mjs` → `listings.json`

Zillow publishes no public agent-profile API. Their official Bridge API needs
an approved MLS or brokerage agreement, and the site blocks browser-side
requests. So the script reads the profile page's own Next.js data island
(`<script id="__NEXT_DATA__">`) — the same structured JSON Zillow's page
renders itself from.

It writes active listings and sales closed within the last six months. The page
renders both from that file; no property is written into `index.html`.

### Videos — `scripts/fetch-videos.mjs` → `videos.json`

YouTube publishes every channel's recent uploads as a public Atom feed. No key,
no auth, no bot check. The script keeps the newest six; the page runs the most
recent one large with the other five beside it.

No YouTube player loads until someone clicks a tile. Six iframes on page load
would pull megabytes of player JavaScript and set cookies for a visitor who
never watched anything, so each tile is a thumbnail until clicked, and the
embeds use `youtube-nocookie`.

---

## Scheduled refreshes

| Workflow | Schedule | Status |
| --- | --- | --- |
| `refresh-videos.yml` | Daily, 11:00 UTC (7am ET) | **Active** |
| `refresh-listings.yml` | — | **Manual only** — see below |

Both commit only when the data actually changed; timestamp-only diffs are
ignored, so you don't get a no-op commit every morning. Either can be run by
hand from the repo's **Actions** tab → pick the workflow → **Run workflow**.

If a run fails at the push step, check
**Settings → Actions → General → Workflow permissions** and set it to
*Read and write*.

### Zillow and the bot check

**The listings schedule is switched off.** Zillow uses PerimeterX, which
fingerprints the request rather than just the IP, and it blocks GitHub's runner
ranges — the headless browser gets shown a *"Press & Hold to confirm you are a
human"* wall instead of the profile. A daily cron there would fail every
morning and email about it.

The script already tries hard: a full set of real Chrome headers with a
cookie warm-up first, then a fallback to Playwright's Chromium which executes
the challenge scripts and retries twice. That is enough from a residential
connection. It is not enough from a datacenter IP, and no amount of extra
stealth reliably changes that.

So for now, refresh listings from a machine on a home connection:

```bash
npm run listings && git commit -am "Refresh listings" && git push
```

Realistically that is a few times a month, when something goes on or off the
market. If you want it automated again, the options are:

1. **A daily job on a Mac at home** — free, uses the IP that already works,
   but only runs when the machine is awake.
2. **A self-hosted GitHub runner** on that same connection — keeps the workflow
   as-is; uncomment the `schedule:` block in `refresh-listings.yml`.
3. **A paid Zillow data provider** (RapidAPI, Bridge Interactive) — works from
   anywhere including CI, costs money monthly.

---

## Before launch

`index.html` ends with a numbered checklist covering the domain swap, Search
Console, Google Business Profile and the analytics ID. The short version:

1. **Swap the placeholder domain.** Absolute URLs across `index.html`,
   `robots.txt` and `sitemap.xml` all say `https://REPLACE-ME.com`:

   ```bash
   grep -rl 'REPLACE-ME.com' . --exclude-dir=.git --exclude-dir=node_modules \
     | xargs sed -i '' 's|https://REPLACE-ME.com|https://yourdomain.com|g'
   ```

   Drop the `''` after `-i` on Linux. Confirm with
   `grep -r REPLACE-ME . --exclude-dir=.git`.

2. **Turn on Google Analytics.** One line near the top of `index.html`:

   ```js
   window.GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
   ```

   Until that is a real ID, a guard skips loading gtag entirely — no requests,
   no console errors. The comment above it has the click-path for creating the
   property. Afterwards, mark `lead_form_submit` and `call_click` as key events
   in GA4 so they count as conversions.

3. **Search Console** — add the domain, verify, submit `/sitemap.xml`.

4. **Google Business Profile** — for a local agent this outranks nearly
   anything on-page. Use the same name, address and phone as the structured
   data in the head.

5. **Contact form** — currently opens the visitor's mail client. Point it at a
   real endpoint.

6. **Social preview image** — `og:image` uses the portrait, which is 535×535.
   Social cards want 1200×630, so it will be cropped oddly when shared.
