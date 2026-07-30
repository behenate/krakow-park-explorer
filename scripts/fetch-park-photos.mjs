/**
 * Fetch one photo per park from Wikimedia Commons, convert to WebP sized for
 * the park-detail hero (960px wide ≈ 380pt @2.5x; phones only, no iPads),
 * and generate the app-side require map + attribution records.
 *
 * Run from parko/:  node scripts/fetch-park-photos.mjs
 * Requires network access (run on your machine, not in a sandbox).
 * Re-runs are incremental: existing .webp files are skipped unless --force.
 *
 * Photos land in assets/parks/{slug}.webp; attribution (author, license,
 * source URL — required by Commons licenses) is written to
 * assets/parks/attribution.json and surfaced in the app as a caption.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const FORCE = process.argv.includes('--force');
const OUT_DIR = 'assets/parks';
const TARGET_WIDTH = 960; // hero is ~380pt wide, 150pt tall → 960px covers ~2.5x
const MAX_HEIGHT = 640;
const WEBP_QUALITY = 72;
const API = 'https://commons.wikimedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'ParkoApp/1.0 (park photo fetcher; contact: dev@parko)' };

// --- parse the park list straight out of parks.ts (id + name) ---
const parksSrc = readFileSync('src/data/parks.ts', 'utf8');
const rows = [...parksSrc.matchAll(/\['([a-z0-9-]+)',\s*'((?:[^'\\]|\\.)*)',\s*'(historical|forest|water)'/g)].map(
  (m) => ({ slug: m[1], name: m[2].replace(/\\'/g, "'") }),
);
if (rows.length !== 78) console.warn(`warning: parsed ${rows.length} parks (expected 78)`);

mkdirSync(OUT_DIR, { recursive: true });
const attributionPath = path.join(OUT_DIR, 'attribution.json');
const attribution = existsSync(attributionPath) ? JSON.parse(readFileSync(attributionPath, 'utf8')) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pause between any two requests (search / imageinfo / download). */
const REQUEST_GAP_MS = 1200;
/** Extra pause between parks. */
const PARK_GAP_MS = 2000;

/** fetch with 429-aware retries: honors Retry-After, else exponential backoff. */
async function politeFetch(url, opts = {}, attempt = 0) {
  const res = await fetch(url, { headers: HEADERS, ...opts });
  if (res.status === 429 && attempt < 5) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * 2 ** attempt;
    console.warn(`  429 rate-limited — waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/5)`);
    await sleep(wait);
    return politeFetch(url, opts, attempt + 1);
  }
  return res;
}

const api = async (params) => {
  await sleep(REQUEST_GAP_MS);
  const url = `${API}?${new URLSearchParams({ action: 'query', format: 'json', ...params })}`;
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
};

const stripHtml = (s) => (s ?? '').replace(/<[^>]*>/g, '').trim();

/**
 * Hand-picked Commons files (curated 2026-07-29, extended 2026-07-30) for parks
 * the automatic title search misses. Exact "File:…" titles on Commons; the
 * normal imageinfo step still fetches author + license for attribution.json.
 * Every entry below was opened and eyeballed — the search ranks by title, which
 * is why it lands on a hotel, a train stop or a bike rack for the near misses.
 */
const CURATED_FILES = {
  'blonia-krakowskie': 'File:Błonia,Kraków 2015.JPG',
  'bulwary-wisly': 'File:Czerwieński boulevard, Krakow, Poland.jpg',
  'fort-batowice': 'File:Krakow Fort Batowice 20080309 1339 2650.jpg',
  'fort-mistrzejowice': 'File:Fort Mistrzejowice 19.IV.2009 -02.jpg',
  // North section opened 2025-06; no Commons photo of it yet — S part of the same park.
  'park-aleksandry-polnoc': 'File:Aleksandry Park, S part, Prokocim, Kraków, Poland.jpg',
  'park-bagry-wielkie': 'File:Bagry Lake (view from West), Krakow, Poland.jpg',
  'park-fort-2-kosciuszko': 'File:DJI 0236 Kopiec Kościuszki.jpg',
  'park-fort-bronowice': 'File:Fort nr 7 Bronowice ul. Rydla moa.JPG',
  // These four shipped before attribution.json existed; the titles were
  // recovered by pixel-matching the shipped .webp against Commons, so pinning
  // them here keeps the credit correct if the images are ever re-fetched.
  'park-im-henryka-jordana': 'File:023Kraków.JPG',
  'park-im-wojciecha-bednarskiego': 'File:North entrance to Bednarski Park, Kraków Poland..jpg',
  'park-jana-matejki': 'File:617683 A 683 Krakow Krzesławice Wankowicza 25 park w zespole dworsko parkowym 52.JPG',
  'park-klasztorna': 'File:Park, Młodości Estate, Mogiła, Nowa Huta, Krakow, Poland.jpg',
  'park-kolejowy': 'File:EstakadaKolejowa-ParkKolejowy-WidokOdPółnocy-Grzegórzki-POL, Kraków.jpg',
  'park-krakowski-im-marka-grechuty': 'File:2025 Kraków, Park Krakowski, 3.jpg',
  'park-kurczaba': 'File:Park Dolina Kurczaba 01.jpg',
  'park-nad-bialucha': 'File:Białucha (Prądnik) river, Nadbrzeżna street, Kraków, Poland.jpg',
  'park-nad-rudawa': 'File:Rudawa river along Błonia, Kraków, Poland, 2019.jpg',
  'park-ogrod-lobzow': 'File:Kraków ul. Podchorążych 1 A-645 PL-617200 Ogród.jpg',
  'park-ogrod-plaszow': 'File:Park Rzeczny Ogród Płaszów w Krakowie 4.jpg',
  'park-przy-dworze-czeczow': 'File:Dwor czeczow db 01.JPG',
  // The whole "Potok pychowicki" series is the same stream; #1 is geotagged
  // inside the park (~260 m from its centre), #3 is ~900 m away.
  'park-pychowicki': 'File:Potok pychowicki 1.jpg',
  'park-rzeczny-drwinka': 'File:DrwinkaIJejDolina-OsNaKozłówce-POL, Kraków.jpg',
  'park-rzeczny-tetmajera': 'File:ParkRzecznyIm.WłodzimierzaTetmajera-WidokOgólny-Bronowice-POL, Kraków.jpg',
  'park-skalskiego': 'File:ParkGen.Pil.StanisławaSkalskiego-OgólnyWidok-OsiedleDywizjonu303-POL, Kraków.jpg',
  'park-sw-wincentego-a-paulo': 'File:St. Vincent de Paul Park, Misjonarska street, Krakow, Poland.JPG',
  'planty-bienczyckie': 'File:PlantyBieńczyckie-OgólnyWidok-OsiedleKazimierzowskie-Bieńczyce-POL, Kraków.jpg',
  'planty-krakowskie': 'File:Planty Park in winter (Kraków).jpg',
  'planty-nowackiego': 'File:Florian Nowacki Planty Park, Emil Serkowski square, Podgórze, Krakow, Poland.jpg',
};

/**
 * Parks with no usable Commons photo (checked 2026-07-30 by name search,
 * category search and geosearch within 1.5 km of the published coordinates).
 * Commons has *something* nearby for most of them — a street, a housing block,
 * a bike-share rack, farmland — but nothing that depicts the park, so the app
 * shows its "PARK PHOTO" placeholder instead of a misleading hero. Skipping
 * them also stops the title search from latching onto those near misses.
 * Re-check occasionally: several of these parks opened after 2023.
 */
const NO_COMMONS_PHOTO = new Set([
  'park-grzegorzecki', // nearest hits are Park przy Śluzie / Park Dąbie — different parks
  'park-kultury', // only Nowohuckie Centrum Kultury building + event photos
  'park-lagiewnicki', // nearest geotagged photo is ul. Turowicza traffic
  'park-linearny-ruczaj', // "Park-e-bike" hits are a bike-share brand, 1.7 km away
  'park-przy-ul-lokietka',
  'park-przy-ul-radzikowskiego', // nearest is a B&W street view of ul. Wizjonerów
  'park-wegrzynowice', // only village buildings and farmland panoramas
  'park-woznicow',
  'park-zlocien', // only the train stop and a watermarked housing-estate photo
  'przylasek-wyciaski', // only a village crossroads in Wyciąże
]);

async function findImage(parkName) {
  // Prefer files whose title mentions the park; search File namespace.
  for (const query of [`"${parkName}" Kraków`, `${parkName} Kraków`]) {
    const j = await api({ list: 'search', srsearch: query, srnamespace: 6, srlimit: 10 });
    const hits = (j.query?.search ?? []).filter((h) => /\.(jpe?g|png|webp)$/i.test(h.title));
    if (hits.length) {
      // Prefer titles containing a distinctive word of the park name.
      const keyword = parkName
        .replace(/^(Park|Lasek?|Las|Staw|Zalew|Zbiornik|Planty|Przylasek)\s+/i, '')
        .split(' ')[0]
        .toLowerCase();
      hits.sort((a, b) => {
        const ak = a.title.toLowerCase().includes(keyword) ? 0 : 1;
        const bk = b.title.toLowerCase().includes(keyword) ? 0 : 1;
        return ak - bk;
      });
      return hits[0].title;
    }
  }
  return null;
}

async function imageInfo(title) {
  const j = await api({
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(TARGET_WIDTH),
  });
  const page = Object.values(j.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    thumbUrl: info.thumburl ?? info.url,
    pageUrl: info.descriptionurl,
    author: stripHtml(meta.Artist?.value) || 'unknown',
    license: stripHtml(meta.LicenseShortName?.value) || 'see source',
  };
}

let done = 0;
let missing = [];
let skipped = [];
for (const { slug, name } of rows) {
  const outFile = path.join(OUT_DIR, `${slug}.webp`);
  if (existsSync(outFile) && !FORCE) {
    done++;
    continue;
  }
  if (NO_COMMONS_PHOTO.has(slug)) {
    skipped.push(slug);
    continue;
  }
  try {
    const title = CURATED_FILES[slug] ?? (await findImage(name));
    if (!title) throw new Error('no Commons match');
    const info = await imageInfo(title);
    // A curated title that no longer resolves is a typo or a Commons rename —
    // report it so it gets fixed, rather than silently grabbing a search hit.
    if (!info?.thumbUrl) {
      throw new Error(CURATED_FILES[slug] ? `curated title not on Commons: ${title}` : 'no image url');
    }
    await sleep(REQUEST_GAP_MS);
    const res = await politeFetch(info.thumbUrl);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
      .resize({ width: TARGET_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outFile);
    attribution[slug] = { file: title, author: info.author, license: info.license, source: info.pageUrl };
    done++;
    console.log(`✓ ${slug}  (${title} · ${info.license})`);
    await sleep(PARK_GAP_MS);
  } catch (e) {
    missing.push(slug);
    console.warn(`✗ ${slug}: ${e.message}`);
  }
}

writeFileSync(attributionPath, JSON.stringify(attribution, null, 2));

// --- regenerate the app-side require map ---
const available = rows.filter(({ slug }) => existsSync(path.join(OUT_DIR, `${slug}.webp`)));
const map = available
  .map(({ slug }) => `  '${slug}': require('../../assets/parks/${slug}.webp'),`)
  .join('\n');
writeFileSync(
  'src/data/parkPhotos.ts',
  `import { ImageSourcePropType } from 'react-native';

/**
 * AUTO-GENERATED by scripts/fetch-park-photos.mjs — do not edit by hand.
 * WebP heroes (max ${TARGET_WIDTH}×${MAX_HEIGHT}, q${WEBP_QUALITY}) from Wikimedia Commons.
 * Attribution lives in assets/parks/attribution.json and MUST stay shipped
 * with the app (Commons licenses require author + license credit).
 */
export const parkPhotos: Record<string, ImageSourcePropType> = {
${map}
};

export interface PhotoCredit {
  file: string;
  author: string;
  license: string;
  source: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const photoCredits: Record<string, PhotoCredit> = require('../../assets/parks/attribution.json');
`,
);

console.log(`\n${done}/${rows.length} photos ready · ${missing.length} missing${missing.length ? ': ' + missing.join(', ') : ''}`);
console.log(`${skipped.length} skipped (no Commons photo exists): ${skipped.join(', ')}`);
console.log('Regenerated src/data/parkPhotos.ts');
