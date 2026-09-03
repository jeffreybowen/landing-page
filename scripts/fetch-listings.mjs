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
 * Zillow page itself renders from. That is a stable, structured source, but
 * it is Zillow's internal shape: if a run fails or the schema moves, the
 * script exits non-zero and LEAVES THE EXISTING listings.json IN PLACE so the
 * site never goes blank.
 *
 * Usage:
 *   node scripts/fetch-listings.mjs
 *   node scripts/fetch-listings.mjs --months 12   # widen the sold window
 *   node scripts/fetch-listings.mjs --out ./listings.json
 *   node scripts/fetch-listings.mjs --from-html cached.html   # offline / testing
 *
 * Requires Node 18+ (global fetch). No dependencies.
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
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const OUT = resolve(process.cwd(), arg('out', DEFAULT_OUT));
const SOLD_WINDOW_MONTHS = Number(arg('months', DEFAULT_SOLD_WINDOW_MONTHS));
const PROFILE = arg('profile', PROFILE_URL);
const FROM_HTML = arg('from-html', null); // parse a saved page instead of fetching

/* ---------- fetch ---------- */
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

async function getProfileHtml(url, attempt = 1) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (res.status === 403 || res.status === 429) {
    if (attempt < 3) {
      const wait = attempt * 4000;
      console.warn(`  Zillow returned ${res.status}; retrying in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      return getProfileHtml(url, attempt + 1);
    }
    throw new Error(
      `Zillow returned ${res.status} (bot check). Try again later, or run this ` +
      `from a residential IP rather than a datacenter/CI runner.`
    );
  }
  if (!res.ok) throw new Error(`Zillow returned HTTP ${res.status}`);
  return res.text();
}

/* ---------- parse ---------- */
function extractNextData(html) {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!m) {
    throw new Error(
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

/* ---------- main ---------- */
async function main() {
  let html;
  if (FROM_HTML) {
    console.log(`Reading saved page ${FROM_HTML} ...`);
    html = await readFile(resolve(process.cwd(), FROM_HTML), 'utf8');
  } else {
    console.log(`Fetching ${PROFILE} ...`);
    html = await getProfileHtml(PROFILE);
  }
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
    `Wrote ${OUT}\n  ${forSale.length} active listing(s), ` +
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
