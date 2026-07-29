/**
 * Four shipped heroes predate attribution.json and have no credit recorded.
 * Re-run the script's own title search for each, then pixel-compare every
 * candidate against the shipped .webp to identify the exact source file.
 * Prints the matching Commons title + author + license for attribution.json.
 */
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const API = 'https://commons.wikimedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'ParkoApp/1.0 (park photo fetcher; contact: dev@parko)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url, attempt = 0) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429 && attempt < 6) {
    await sleep(6000 * 2 ** attempt);
    return politeFetch(url, attempt + 1);
  }
  return res;
}
async function api(params) {
  await sleep(1500);
  const res = await politeFetch(`${API}?${new URLSearchParams({ action: 'query', format: 'json', ...params })}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
const stripHtml = (s) => (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** 16x16 grayscale fingerprint — robust to the webp re-encode and resize. */
const fingerprint = (buf) =>
  sharp(buf).greyscale().resize(16, 16, { fit: 'fill' }).raw().toBuffer();
const rmse = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s / a.length);
};

const TARGETS = [
  { slug: 'park-im-wojciecha-bednarskiego', name: 'Park im. Wojciecha Bednarskiego' },
  { slug: 'park-krakowski-im-marka-grechuty', name: 'Park Krakowski im. Marka Grechuty' },
  { slug: 'park-im-henryka-jordana', name: 'Park im. Henryka Jordana' },
  { slug: 'planty-krakowskie', name: 'Planty Krakowskie' },
];

for (const { slug, name } of TARGETS) {
  const local = `assets/parks/${slug}.webp`;
  if (!existsSync(local)) {
    console.log(`${slug}: no local file`);
    continue;
  }
  const localFp = await fingerprint(local);

  // Same queries, in the same order, as findImage() in fetch-park-photos.mjs.
  const titles = [];
  for (const q of [`"${name}" Kraków`, `${name} Kraków`]) {
    const j = await api({ list: 'search', srsearch: q, srnamespace: 6, srlimit: 10 });
    for (const h of j.query?.search ?? []) {
      if (/\.(jpe?g|png|webp)$/i.test(h.title) && !titles.includes(h.title)) titles.push(h.title);
    }
  }

  let best = null;
  for (const title of titles) {
    try {
      const j = await api({ titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '960' });
      const page = Object.values(j.query?.pages ?? {})[0];
      const info = page?.imageinfo?.[0];
      if (!info?.thumburl) continue;
      await sleep(1500);
      const res = await politeFetch(info.thumburl);
      if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) continue;
      const score = rmse(localFp, await fingerprint(Buffer.from(await res.arrayBuffer())));
      if (!best || score < best.score) {
        const meta = info.extmetadata ?? {};
        best = {
          score,
          title,
          author: stripHtml(meta.Artist?.value) || 'unknown',
          license: stripHtml(meta.LicenseShortName?.value) || 'see source',
          source: info.descriptionurl,
        };
      }
    } catch (e) {
      console.error(`  ${title}: ${e.message}`);
    }
  }
  console.log(
    best
      ? `${best.score < 6 ? 'MATCH' : 'no match'} ${slug} · rmse=${best.score.toFixed(2)} · ${best.title} · ${best.author} · ${best.license}\n  ${best.source}`
      : `${slug}: no candidates`,
  );
}
