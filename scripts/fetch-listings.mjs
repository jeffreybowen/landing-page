#!/usr/bin/env node
/**
 * fetch-listings.mjs
 * ------------------
 * Pulls Jeffrey Bowen's active listings and recent sales from his Zillow
 * profile and writes them to ../listings.json, which index.html renders at
 * page load. Nothing about the listings is hard-coded in the HTML.
 *
 * Zillow has no public agent-profile API, so this reads the profile page's
 * own Next.js data island (<script id="__NEXT_DATA__">) -- the same JSON the
 * Zillow page itself renders from.
 *
 * GETTING PAST THE BOT CHECK
 * Zillow fronts the site with bot protection that fingerprints the request,
 * not just the IP, so a bare fetch() gets a 403 (or a 200 carrying a
 * challenge page instead of the data island). Two strategies, in order:
 *
 *   1. Hardened HTTP. A full set of the headers a real Chrome sends, plus a
 *      warm-up request to the homepage first so the profile request arrives
 *      with cookies and a plausible Referer. No dependencies. Often enough
 *      from a residential IP; usually not from a CI runner.
 *
 *   2. A real browser. Falls back to Playwright's Chromium, which executes
 *      the challenge scripts like any browser and then hands us the rendered
 *      DOM. This is what makes the scheduled refresh work from CI.
 *
 * Playwright is an optional dependency: it is loaded only when the fallback
 * is actually needed, so a plain `node scripts/fetch-listings.mjs` still runs
 * on a machine that has never installed it.
 *
 * Usage:
 *   node scripts/fetch-listings.mjs                  # HTTP, then browser
 *   node scripts/fetch-listings.mjs --browser        # skip straight to browser
 *   node scripts/fetch-listings.mjs --no-browser     # HTTP only, fail if blocked
 *   node scripts/fetch-listings.mjs --months 12      # widen the sold window
 *   node scripts/fetch-listings.mjs --out ./listings.json
 *   node scripts/fetch-listings.mjs --from-html cached.html   # offline / testing
 *
 * On ANY failure the script exits non-zero and LEAVES THE EXISTING
 * listings.json IN PLACE, so the site never goes blank.
 *
 * Requires Node 18+ for the HTTP path. The browser fallback needs Node 20+
 * (Playwright's own floor) and:
 *   npm i -D playwright && npx playwright install chromium
 */

import { writeFile, rename, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROFILE_URL = 'https://www.zillow.com/profile/JeffreyBowen';
const DEFAULT_OUT = resolve(__dirname, '..', 'listings.json');
const DEFAULT_SOLD_WINDOW_MONTHS = 6;

/* ---------- args ---------- */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const OUT = resolve(process.cwd(), arg('out', DEFAULT_OUT));
const SOLD_WINDOW_MONTHS = Number(arg('months', DEFAULT_SOLD_WINDOW_MONTHS));
const PROFILE = arg('profile', PROFILE_URL);
const FROM_HTML = arg('from-html', null);
const FORCE_BROWSER = flag('browser');
const NO_BROWSER = flag('no-browser');

/** Thrown when Zillow served a challenge rather than the page. Recoverable. */
class BotBlocked extends Error {}

/* ---------- strategy 1: hardened HTTP ---------- */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** The header set a real Chrome sends for a top-level document request. */
function documentHeaders(referer) {
  const h = {
    'User-Agent': UA,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
      'image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Chromium";v="126", "Not:A-Brand";v="24", "Google Chrome";v="126"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
  if (referer) h.Referer = referer;
  return h;
}

function readCookies(res) {
  const jar = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  return jar
    .map((c) => String(c).split(';')[0])
    .filter((c) => c.includes('='))
    .join('; ');
}

async function fetchViaHttp(url) {
  // Warm up: land on the site root first so the profile request carries the
  // cookies a browsing session would have, and a same-origin Referer. Derived
  // from the target URL rather than hard-coded, so --profile stays honest.
  const home = new URL('/', url).href;

  let cookie = '';
  try {
    const res = await fetch(home, { headers: documentHeaders(null), redirect: 'follow' });
    cookie = readCookies(res);
  } catch {
    /* warm-up is best-effort; carry on without cookies */
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    const headers = documentHeaders(home);
    if (cookie) headers.Cookie = cookie;

    const res = await fetch(url, { headers, redirect: 'follow' });
    const fresh = readCookies(res);
    if (fresh) cookie = cookie ? `${cookie}; ${fresh}` : fresh;

    if (res.status === 403 || res.status === 429 || res.status === 503) {
      if (attempt < 3) {
        const wait = attempt * 5000;
        console.warn(`  HTTP ${res.status} from Zillow; retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new BotBlocked(`Zillow returned ${res.status}`);
    }
    if (!res.ok) throw new Error(`Zillow returned HTTP ${res.status}`);

    const html = await res.text();
    if (!/id="__NEXT_DATA__"/.test(html)) {
      throw new BotBlocked('Zillow served a page without the data island (challenge page)');
    }
    return html;
  }
  throw new BotBlocked('exhausted HTTP retries');
}

/* ---------- strategy 2: a real browser ---------- */

async function fetchViaBrowser(url) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(
      'Playwright is not installed, so the browser fallback is unavailable.\n' +
      '  Install it with:  npm i -D playwright && npx playwright install chromium\n' +
      '  Or run with --no-browser to fail fast on the HTTP attempt alone.'
    );
  }

  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });
    const page = await context.newPage();

    // The data island is in the served HTML, so we do not need images or fonts.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      return ['image', 'media', 'font'].includes(type) ? route.abort() : route.continue();
    });

    // A bot wall usually clears on a second look -- the challenge script runs,
    // sets its cookie and the reload comes back with the real page.
    let lastBody = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      try {
        await page.waitForSelector('#__NEXT_DATA__', { state: 'attached', timeout: 20000 });
        return await page.content();
      } catch {
        lastBody = (await page.title().catch(() => '')) + ' ' +
                   (await page.evaluate(() => document.body ? document.body.innerText.slice(0, 200) : '')
                      .catch(() => ''));
        if (attempt < 3) {
          console.warn(`  Browser attempt ${attempt} hit a challenge page; retrying in ${attempt * 6}s...`);
          await page.waitForTimeout(attempt * 6000);
        }
      }
    }

    throw new BotBlocked(
      'the headless browser was shown a challenge page too, not the profile. ' +
      `Page said: "${lastBody.replace(/\s+/g, ' ').trim().slice(0, 140)}". ` +
      'Zillow is blocking this IP -- try again later, or run the refresh from a ' +
      'residential connection rather than a CI runner.'
    );
  } finally {
    await browser.close();
  }
}

/* ---------- parse ---------- */

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) {
    throw new BotBlocked(
      '__NEXT_DATA__ not found. Zillow either served a bot-check page or ' +
      'changed its page shape.'
    );
  }
  return JSON.parse(m[1]);
}

/** Walk the object tree for the listings/sales section, wherever it moves to. */
function findSection(data) {
  const direct = data?.props?.pageProps?.graphQLData?.agentListingSalesSection?.content;
  if (direct?.forSale && direct?.sold) return direct;

  let found = null;
  (function walk(node) {
    if (found || !node || typeof node !== 'object') return;
    if (
      node.forSale && node.sold &&
      Array.isArray(node.forSale.properties) &&
      Array.isArray(node.sold.properties)
    ) { found = node; return; }
    for (const v of Object.values(node)) walk(v);
  })(data);

  if (!found) throw new Error('Could not locate the listings/sales section in __NEXT_DATA__.');
  return found;
}

const ABS = (u) => (!u ? null : u.startsWith('http') ? u : `https://www.zillow.com${u}`);

/** Zillow serves several photo sizes off one id; -p_e is a good card size. */
const photoAt = (url, size = 'p_e') =>
  !url ? null : url.replace(/-[a-z]+_[a-z]\.jpg$/i, `-${size}.jpg`);

function splitAddress(full) {
  // "804 Saratoga St #1, Boston, MA 02128" -> street + "Boston, MA 02128"
  const parts = (full || '').split(',').map((s) => s.trim());
  if (parts.length < 2) return { street: full || '', locality: '' };
  return { street: parts[0], locality: parts.slice(1).join(', ') };
}

function attrs(list) {
  const out = { beds: null, baths: null, sqft: null };
  for (const a of list || []) {
    const label = String(a.label || '').toLowerCase();
    if (label.startsWith('bd')) out.beds = a.value;
    else if (label.startsWith('ba')) out.baths = a.value;
    else if (label.startsWith('sq')) out.sqft = a.value;
  }
  return out;
}

const money = (t) => Number(String(t || '').replace(/[^0-9]/g, '')) || null;

function mapForSale(p) {
  const { street, locality } = splitAddress(p.fullAddressText);
  return {
    zpid: String(p.zpid),
    price: p.priceText,
    priceValue: money(p.priceText),
    street,
    locality,
    fullAddress: p.fullAddressText,
    ...attrs(p.attributes),
    status: p.homeStatusLine || 'For sale',
    badges: (p.badges || []).filter(Boolean),
    brokerage: p.brokerageInfo?.name || null,
    photo: photoAt(p.imageUrl),
    url: ABS(p.hdpUrl),
  };
}

function mapSold(p) {
  const { street, locality } = splitAddress(p.fullAddressText);
  const date = p.transactionDate || null;
  const sides = (p.badges || []).filter((b) => /buyer|seller/i.test(b));
  return {
    zpid: String(p.zpid),
    price: p.priceText,
    priceValue: money(p.priceText),
    street,
    locality,
    fullAddress: p.fullAddressText,
    ...attrs(p.attributes),
    soldDate: date,
    soldDateText: date
      ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        })
      : null,
    soldAgo: p.homeStatusLine || null,
    represented: sides.length
      ? `Represented ${sides.map((s) => s.toLowerCase()).join(' and ')}`
      : null,
    photo: photoAt(p.imageUrl),
    url: ABS(p.hdpUrl),
  };
}

function withinMonths(isoDate, months) {
  if (!isoDate) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return new Date(`${isoDate}T12:00:00Z`) >= cutoff;
}

const countFromHeader = (t) => {
  const m = String(t || '').match(/\((\d[\d,]*)\)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

/* ---------- get the page, however we can ---------- */

async function getHtml() {
  if (FROM_HTML) {
    console.log(`Reading saved page ${FROM_HTML} ...`);
    return { html: await readFile(resolve(process.cwd(), FROM_HTML), 'utf8'), via: 'file' };
  }

  if (FORCE_BROWSER) {
    console.log(`Fetching ${PROFILE} with a headless browser ...`);
    return { html: await fetchViaBrowser(PROFILE), via: 'browser' };
  }

  console.log(`Fetching ${PROFILE} ...`);
  try {
    return { html: await fetchViaHttp(PROFILE), via: 'http' };
  } catch (err) {
    if (!(err instanceof BotBlocked)) throw err;
    console.warn(`  Blocked over plain HTTP: ${err.message}`);
    if (NO_BROWSER) {
      throw new Error(
        `${err.message}. --no-browser was set, so the browser fallback was skipped.`
      );
    }
    console.warn('  Falling back to a headless browser ...');
    return { html: await fetchViaBrowser(PROFILE), via: 'browser' };
  }
}

/* ---------- main ---------- */

async function main() {
  const { html, via } = await getHtml();
  const section = findSection(extractNextData(html));

  const forSale = section.forSale.properties.map(mapForSale)
    .sort((a, b) => (b.priceValue || 0) - (a.priceValue || 0));

  const allSold = section.sold.properties.map(mapSold)
    .sort((a, b) => String(b.soldDate).localeCompare(String(a.soldDate)));
  const sold = allSold.filter((s) => withinMonths(s.soldDate, SOLD_WINDOW_MONTHS));

  if (!forSale.length && !sold.length) {
    throw new Error('Parsed 0 listings and 0 qualifying sales — refusing to overwrite listings.json.');
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: PROFILE,
    fetchedVia: via,
    soldWindowMonths: SOLD_WINDOW_MONTHS,
    counts: {
      forSale: forSale.length,
      soldInWindow: sold.length,
      totalForSale: countFromHeader(section.forSale.headerText) ?? forSale.length,
      totalSold: countFromHeader(section.sold.headerText),
    },
    forSale,
    sold,
  };

  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(tmp, OUT); // atomic: the site never reads a half-written file
  console.log(
    `Wrote ${OUT}  (via ${via})\n  ${forSale.length} active listing(s), ` +
    `${sold.length} sale(s) in the last ${SOLD_WINDOW_MONTHS} months ` +
    `(${allSold.length} returned by Zillow).`
  );
}

main().catch(async (err) => {
  console.error(`\nfetch-listings failed: ${err.message}`);
  try {
    const prev = JSON.parse(await readFile(OUT, 'utf8'));
    console.error(`Kept existing listings.json (generated ${prev.generatedAt}).`);
  } catch {
    console.error('No existing listings.json to fall back on.');
  }
  process.exit(1);
});
