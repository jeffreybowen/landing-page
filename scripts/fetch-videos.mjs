#!/usr/bin/env node
/**
 * fetch-videos.mjs
 * ----------------
 * Pulls Jeffrey's latest YouTube uploads into ../videos.json, which index.html
 * renders in the Video tours section. Nothing about a video is hard-coded in
 * the HTML.
 *
 * Unlike the Zillow fetch, this needs no browser and no API key: YouTube
 * publishes every channel's recent uploads as a public Atom feed at
 *
 *     https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>
 *
 * which is not bot-protected and works fine from CI. The feed carries the 15
 * most recent uploads; we keep the newest few.
 *
 * Usage:
 *   node scripts/fetch-videos.mjs
 *   node scripts/fetch-videos.mjs --limit 8
 *   node scripts/fetch-videos.mjs --channel UCxxxxxxxxxxxxxxxxxxxxxx
 *   node scripts/fetch-videos.mjs --out ./videos.json
 *   node scripts/fetch-videos.mjs --from-xml cached.xml    # offline / testing
 *
 * scripts/__fixtures__/videos.xml is a trimmed real feed for exercising the
 * parser without network.
 *
 * On any failure it exits non-zero and LEAVES THE EXISTING videos.json IN
 * PLACE, so the section never empties out.
 *
 * Requires Node 18+. No dependencies.
 */

import { writeFile, rename, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The uploads playlist is UU + the channel id minus its UC prefix, which is
// how the old hard-coded embed referenced this same channel.
const CHANNEL_ID = 'UCrh1Ih1lL0Xc4fAUfbR3KaA';
const CHANNEL_URL = 'https://www.youtube.com/@JeffreyBowen';
const DEFAULT_OUT = resolve(__dirname, '..', 'videos.json');
const DEFAULT_LIMIT = 6;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

const OUT = resolve(process.cwd(), arg('out', DEFAULT_OUT));
const LIMIT = Math.max(1, Number(arg('limit', DEFAULT_LIMIT)));
const CHANNEL = arg('channel', CHANNEL_ID);
const FROM_XML = arg('from-xml', null);

const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CHANNEL)}`;

/* ---------- fetch ---------- */

async function getFeed() {
  if (FROM_XML) {
    console.log(`Reading saved feed ${FROM_XML} ...`);
    return readFile(resolve(process.cwd(), FROM_XML), 'utf8');
  }
  console.log(`Fetching ${FEED} ...`);
  const res = await fetch(FEED, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`YouTube returned HTTP ${res.status}`);
  return res.text();
}

/* ---------- parse ----------
   A dependency-free reader for the handful of Atom fields we need. The feed
   is machine-generated and stable, so targeted extraction beats pulling in an
   XML parser for four tags. */

const decode = (t) =>
  String(t)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : null;
}

function parseFeed(xml) {
  const channelTitle = tag(xml.split('<entry>')[0], 'title');
  const entries = xml.split('<entry>').slice(1).map((chunk) => {
    const id = tag(chunk, 'yt:videoId');
    if (!id) return null;

    const published = tag(chunk, 'published');
    // Shorts are vertical. Their 16:9 thumbnail is letterboxed, so the page
    // needs to know which is which to crop rather than pillar-box them.
    const isShort = /href="[^"]*\/shorts\//.test(chunk);

    return {
      id,
      title: tag(chunk, 'media:title') || tag(chunk, 'title') || 'Untitled',
      published,
      publishedText: published
        ? new Date(published).toLocaleDateString('en-US', {
            month: 'long', year: 'numeric', timeZone: 'UTC',
          })
        : null,
      isShort,
      url: isShort
        ? `https://www.youtube.com/shorts/${id}`
        : `https://www.youtube.com/watch?v=${id}`,
      // youtube-nocookie so a visitor who never presses play is not tracked.
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      // maxres does not exist for every upload; the page falls back to hq.
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      thumbLarge: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    };
  }).filter(Boolean);

  return { channelTitle, entries };
}

/* ---------- main ---------- */

async function main() {
  const xml = await getFeed();
  const { channelTitle, entries } = parseFeed(xml);

  if (!entries.length) {
    throw new Error('Parsed 0 videos from the feed — refusing to overwrite videos.json.');
  }

  // Newest first. The feed is already ordered, but do not rely on it.
  entries.sort((a, b) => String(b.published).localeCompare(String(a.published)));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: FEED,
    channelUrl: CHANNEL_URL,
    channelTitle: channelTitle || 'Jeffrey Bowen',
    counts: { shown: Math.min(LIMIT, entries.length), availableInFeed: entries.length },
    videos: entries.slice(0, LIMIT),
  };

  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(tmp, OUT);
  console.log(
    `Wrote ${OUT}\n  ${payload.videos.length} video(s), newest "${payload.videos[0].title}" ` +
    `(${payload.videos[0].publishedText}).`
  );
}

main().catch(async (err) => {
  console.error(`\nfetch-videos failed: ${err.message}`);
  try {
    const prev = JSON.parse(await readFile(OUT, 'utf8'));
    console.error(`Kept existing videos.json (generated ${prev.generatedAt}).`);
  } catch {
    console.error('No existing videos.json to fall back on.');
  }
  process.exit(1);
});
