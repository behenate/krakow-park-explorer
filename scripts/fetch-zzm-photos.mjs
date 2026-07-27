/**
 * Fetch official park photos from zzm.krakow.pl (nicer than the Wikimedia
 * set), convert to WebP sized for the park-detail hero, and regenerate the
 * app-side require map. ZZM photos OVERWRITE existing Wikimedia ones for the
 * parks listed below; unmapped parks keep whatever they already have.
 *
 * Run from parko/:  node scripts/fetch-zzm-photos.mjs
 * Requires network access (run on your machine, not in a sandbox).
 *
 * NOTE: these photos come from the city greenery authority's website and are
 * not openly licensed like Wikimedia Commons — fine for a personal build,
 * but clear rights with ZZM before any public release.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = 'assets/parks';
const TARGET_WIDTH = 960;
const MAX_HEIGHT = 640;
const WEBP_QUALITY = 72;
const BASE = 'https://zzm.krakow.pl';
const HEADERS = { 'User-Agent': 'ParkoApp/1.0 (park photo fetcher; contact: dev@parko)' };

/** parkId → { img, page } — extracted from the official ZZM park pages. */
const ZZM_PHOTOS = {
  'planty-krakowskie': { img: '/images/Zdjecia/Projekt%20bez%20nazwy17.jpg', page: '/lista-parkow/256-planty-krakowskie.html' },
  'park-strzelecki': { img: '/images/DJI_0009.jpg', page: '/lista-parkow/255-park-strzelecki.html' },
  'park-dabie': { img: '/images/DabDJI_0006.jpg', page: '/lista-parkow/254-park-dabie.html' },
  'park-zaczarowanej-dorozki': { img: '/images/Zdjecia/PARKI/ParkZaczarowanejDorozkiMAX.jpg', page: '/lista-parkow/257-park-stawy-dominikanskie.html' },
  'park-im-tadeusza-kosciuszki': { img: '/images/Zdjecia/PARKI/ParkKosciuszkiMAX.jpg', page: '/lista-parkow/206-park-im-tadeusza-kosciuszki.html' },
  'park-kleparski': { img: '/images/Zdjecia/PARKI/Park%20Kleparskimax.jpg', page: '/lista-parkow/221-park-kleparski.html' },
  'park-im-stanislawa-wyspianskiego': { img: '/images/Zdjecia/PARKI/Park%20Wyspianskiegomax.jpg', page: '/lista-parkow/220-park-im-stanislawa-wyspianskiego-w-krakowie.html' },
  'park-krowoderski': { img: '/images/DJI_0081.jpg', page: '/lista-parkow/207-park-krowoderski.html' },
  'park-mlynowka-krolewska': { img: '/images/Zdjecia/PARKI/ParkMlynowkaKrolewskaBIG.jpg', page: '/lista-parkow/224-park-mlynowka-krolewska.html' },
  'park-im-henryka-jordana': { img: '/images/DJI_0029.jpg', page: '/lista-parkow/209-park-im-henryka-jordana.html' },
  'park-krakowski-im-marka-grechuty': { img: '/images/Zdjecia/PARKI/pkrakowskimax.jpg', page: '/lista-parkow/222-park-krakowski.html' },
  'park-decjusza': { img: '/images/Zdjecia/PARKI/PARKDECJUSZABIG.jpg', page: '/lista-parkow/208-park-decjusza.html' },
  'park-solvay': { img: '/images/Zdjecia/PARKI/SOLVAYBIG.jpg', page: '/lista-parkow/251-park-solvay.html' },
  'park-macka-i-doroty': { img: '/images/Zdjecia/PARKI/PARKMACKAIDOROTYBIG.jpg', page: '/lista-parkow/248-park-im-macka-i-doroty.html' },
  'park-debnicki': { img: '/images/pliki/aktualnosci/PARKI_2020/debnicki/DJI_0033.jpg', page: '/lista-parkow/244-park-debnicki-w-krakowie.html' },
  'park-lilli-wenedy': { img: '/images/pliki/aktualnosci/PARKI_2020/lilii/1.jpg', page: '/lista-parkow/247-park-lilli-wenedy.html' },
  'park-aleksandry': { img: '/images/pliki/aktualnosci/PARKI_2020/aleksandry/1.jpg', page: '/lista-parkow/242-park-aleksandry.html' },
  'park-rzaka': { img: '/images/Zdjecia/przaka%201.jpg', page: '/lista-parkow/250-park-rzaka.html' },
  'park-kurdwanow': { img: '/images/Zdjecia/kurdwanow%201.jpg', page: '/lista-parkow/246-park-kurdwanow.html' },
  'park-jerzmanowskich': { img: '/images/pliki/aktualnosci/PARKI_2020/jerzmanowskich/Jerzmanowskich_3.jpg', page: '/lista-parkow/245-park-im-erazma-i-anny-jerzmanowskich.html' },
  'park-im-wojciecha-bednarskiego': { img: '/images/GLOWNA%20FOTOGRAFIA/Park%20Bednarskiego.jpg', page: '/lista-parkow/243-park-im-wojciecha-bednarskiego.html' },
  'park-lotnikow-polskich': { img: '/images/GLOWNA%20FOTOGRAFIA/Park%20Lotnikow%20Polskich.png', page: '/lista-parkow/230-park-lotnikow-polskich.html' },
  'park-tysiaclecia': { img: '/images/Zdjecia/Park%20Tysiaclecia.jpg', page: '/lista-parkow/235-park-tysiaclecia.html' },
  'planty-mistrzejowickie': { img: '/images/pliki/aktualnosci/PARKI_2020/plantyMistrzejowickie/jpg/DJI_0140.jpg', page: '/lista-parkow/239-planty-mistrzejowickie.html' },
  'zalew-nowohucki': { img: '/images/Zdjecia/nh.jpg', page: '/lista-parkow/237-park-zalew-nowohucki.html' },
  'park-zielony-jar': { img: '/images/pliki/aktualnosci/PARKI_2020/jarWandy/DJI_0004.jpg', page: '/lista-parkow/241-park-zielony-jar.html' },
  'park-ratuszowy': { img: '/images/pliki/aktualnosci/PARKI_2020/ratuszowy/DJI_0014.jpg', page: '/lista-parkow/232-park-ratuszowy.html' },
  'park-szwedzki': { img: '/images/pliki/aktualnosci/PARKI_2020/szwedzki/Monitor/DJI_0005.jpg', page: '/lista-parkow/234-park-szwedzki.html' },
  'park-bagry-wielkie': { img: '/images/Zdjecia/bagryzalew.jpg', page: '/lista-parkow/443-zalew-bagry.html' },
  'park-stacja-wisla': { img: '/images/pliki/aktualnosci/PARKI_2020/stacjawisla/DJI_0039.jpg', page: '/lista-parkow/445-park-stacja-wisla.html' },
  'park-zakrzowek': { img: '/images/Zdjecia/zkzk.jpg', page: '/lista-parkow/446-zakrzowek.html' },
  'park-duchacki': { img: '/images/Zdjecia/duchacki.jpg', page: '/lista-parkow/865-park-duchacki.html' },
  'park-wadow': { img: '/images/pliki/galeria/Wadow/87030001.jpg', page: '/lista-parkow/240-park-wadow.html' },
  'staw-plaszowski': { img: '/images/Zdjecia/staf.jpg', page: '/lista-parkow/444-staw-plaszowski.html' },
  'park-ogrod-plaszow': { img: '/images/pliki/aktualnosci/PARKI_2020/plaszow/1.jpg', page: '/lista-parkow/249-park-plaszow.html' },
  'park-im-stefana-zeromskiego': { img: '/images/Zdjecia/zeromianka.jpg', page: '/lista-parkow/238-park-zeromskiego.html' },
  'park-reduta': { img: '/images/redut.jpg', page: '/lista-parkow/663-park-reduta.html' },
  'park-czyzyny': { img: '/images/pliki/aktualnosci/PARKI_2020/Czyzyny/2.jpg', page: '/lista-parkow/857-park-czyzyny.html' },
  'park-rzeczny-wilga': { img: '/images/pliki/galeria/AKTUALNOSCI/co_robimy/wilga_10.jpg', page: '/lista-parkow/883-park-rzeczny-wilga-i-etap.html' },
  'park-fort-bronowice': { img: '/images/Zdjecia/parkprzyforciebronowice.jpg', page: '/lista-parkow/1614-park-przy-forcie-bronowice.html' },
  'park-nad-bialucha': { img: '/images/Zdjecia/Park%20Rzeczny%20Bialucha%202.jpg', page: '/lista-parkow/1527-park-rzeczny-bialucha.html' },
  'park-rzeczny-drwinka': { img: '/images/Zdjecia/Park%20Rzeczny%20Drwinka%201.jpg', page: '/lista-parkow/1525-park-rzeczny-drwinka.html' },
  'park-nad-sudolem': { img: '/images/modules/1sudolem.jpg', page: '/lista-parkow-kieszonkowych/1227-park-kieszonkowy-ogrod-nad-sudolem.html' },
  'park-jalu-kurka': { img: '/images/Zdjecia/Jalu%20Kurka/JALU2.jpg', page: '/lista-parkow/1417-park-jalu-kurka.html' },
  'park-im-wislawy-szymborskiej': { img: '/images/Zdjecia/karmelek.jpg', page: '/lista-parkow/1418-park-im-wislawy-szymborskiej.html' },
  'park-zlocien': { img: '/images/Zdjecia/zlocien.jpg', page: '/aktualnosci/1348-park-zlocien-przy-ul-mariana-domagaly.html' },
};

mkdirSync(OUT_DIR, { recursive: true });
const attributionPath = path.join(OUT_DIR, 'attribution.json');
const attribution = existsSync(attributionPath) ? JSON.parse(readFileSync(attributionPath, 'utf8')) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REQUEST_GAP_MS = 1500;

async function politeFetch(url, attempt = 0) {
  const res = await fetch(url, { headers: HEADERS });
  if ((res.status === 429 || res.status === 503) && attempt < 5) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * 2 ** attempt;
    console.warn(`  ${res.status} — waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/5)`);
    await sleep(wait);
    return politeFetch(url, attempt + 1);
  }
  return res;
}

let done = 0;
const missing = [];
for (const [slug, { img, page }] of Object.entries(ZZM_PHOTOS)) {
  try {
    await sleep(REQUEST_GAP_MS);
    const res = await politeFetch(BASE + img);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
      .resize({ width: TARGET_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(path.join(OUT_DIR, `${slug}.webp`));
    attribution[slug] = {
      file: decodeURIComponent(img.split('/').pop()),
      author: 'ZZM Kraków',
      license: 'zzm.krakow.pl',
      source: BASE + page,
    };
    done++;
    console.log(`✓ ${slug}`);
  } catch (e) {
    missing.push(slug);
    console.warn(`✗ ${slug}: ${e.message}`);
  }
}

writeFileSync(attributionPath, JSON.stringify(attribution, null, 2));

// --- regenerate the app-side require map (shared with the Wikimedia script) ---
const parksSrc = readFileSync('src/data/parks.ts', 'utf8');
const rows = [...parksSrc.matchAll(/\['([a-z0-9-]+)',\s*'((?:[^'\\]|\\.)*)',\s*'(historical|forest|water)'/g)].map(
  (m) => ({ slug: m[1] }),
);
const available = rows.filter(({ slug }) => existsSync(path.join(OUT_DIR, `${slug}.webp`)));
const map = available
  .map(({ slug }) => `  '${slug}': require('../../assets/parks/${slug}.webp'),`)
  .join('\n');
writeFileSync(
  'src/data/parkPhotos.ts',
  `import { ImageSourcePropType } from 'react-native';

/**
 * AUTO-GENERATED by scripts/fetch-zzm-photos.mjs / fetch-park-photos.mjs —
 * do not edit by hand. WebP heroes (max ${TARGET_WIDTH}×${MAX_HEIGHT}, q${WEBP_QUALITY}) from the
 * official ZZM pages (preferred) and Wikimedia Commons. Attribution lives in
 * assets/parks/attribution.json and MUST stay shipped with the app.
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

console.log(`\n${done}/${Object.keys(ZZM_PHOTOS).length} ZZM photos ready · ${missing.length} failed${missing.length ? ': ' + missing.join(', ') : ''}`);
console.log('Regenerated src/data/parkPhotos.ts');
