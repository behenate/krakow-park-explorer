/**
 * Stamp layers for the official list revision: 26 new parks get layers built
 * from the retired parks' motifs (recolored to their category ink), and 4
 * renamed parks get their arc text updated. Placeholder art until real
 * stamps are drawn — same template as the original set.
 *
 * Reads templates from  ../assets/stamps/layers/parks/*.svg  (repo root),
 * writes new SVGs there and rasterized PNGs (200/400/600 px) into
 * assets/stamps/layers/ (app side). Run from parko/:
 *   node scripts/gen-official-stamps.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const SVG_DIR = '../assets/stamps/layers/parks';
const OUT_DIR = 'assets/stamps/layers';

const INK = { historical: '#b04437', forest: '#6f8153', water: '#4f7d99' };

/** [newSlug, sourceSlug, arcText, category] — source motif is recolored. */
const JOBS = [
  // historical (11)
  ['fort-mistrzejowice', 'park-krowoderskich-zuchow', 'FORT MISTRZEJOWICE', 'historical'],
  ['fort-batowice', 'park-bialopradnicki', 'FORT BATOWICE', 'historical'],
  ['park-fort-2-kosciuszko', 'park-im-wyslouchow', 'FORT 2 KOŚCIUSZKO', 'historical'],
  ['park-sw-wincentego-a-paulo', 'park-wandy', 'PARK ŚW. WINCENTEGO', 'historical'],
  ['park-jana-matejki', 'park-lesny-witkowice', 'PARK JANA MATEJKI', 'historical'],
  ['park-przy-dworze-czeczow', 'park-mydlniki', 'PARK PRZY DWORZE CZECZÓW', 'historical'],
  ['blonia-krakowskie', 'park-piaski-wielkie', 'BŁONIA KRAKOWSKIE', 'historical'],
  ['park-ogrod-lobzow', 'park-bronowicki', 'PARK OGRÓD ŁOBZÓW', 'historical'],
  ['park-kolejowy', 'park-wieczysta', 'PARK KOLEJOWY', 'historical'],
  ['planty-nowackiego', 'park-kliny', 'PLANTY NOWACKIEGO', 'historical'],
  ['park-klasztorna', 'park-wzgorza-krzeslawickie', 'PARK KLASZTORNA', 'historical'],
  // forest (12)
  ['park-kultury', 'las-wolski', 'PARK KULTURY', 'forest'],
  ['park-wegrzynowice', 'lasek-mogilski', 'PARK WĘGRZYNOWICE', 'forest'],
  ['planty-bienczyckie', 'lasek-legowski', 'PLANTY BIEŃCZYCKIE', 'forest'],
  ['park-skalskiego', 'park-skalki-twardowskiego', 'PARK GEN. SKALSKIEGO', 'forest'],
  ['park-woznicow', 'panienskie-skaly', 'PARK WOŹNICÓW', 'forest'],
  ['park-aleksandry-polnoc', 'park-bonarka', 'PARK ALEKSANDRY PÓŁNOC', 'forest'],
  ['park-pychowicki', 'park-gorka-narodowa', 'PARK PYCHOWICKI', 'forest'],
  ['park-linearny-ruczaj', 'staw-bonarka', 'PARK LINEARNY RUCZAJ', 'forest'],
  ['park-przy-ul-radzikowskiego', 'park-rybitwy', 'PARK RADZIKOWSKIEGO', 'forest'],
  ['park-przy-ul-lokietka', 'park-nad-dlubnia', 'PARK PRZY UL. ŁOKIETKA', 'forest'],
  ['park-lagiewnicki', 'park-sudol-dominikanski', 'PARK ŁAGIEWNICKI', 'forest'],
  ['park-kurczaba', 'staw-przy-kaczencowej', 'PARK KURCZABA', 'forest'],
  // water (3)
  ['przylasek-wyciaski', 'park-plaszowski', 'PRZYLASEK WYCIĄSKI', 'water'],
  ['park-rzeczny-tetmajera', 'staw-dabski', 'PARK RZECZNY TETMAJERA', 'water'],
  ['bulwary-wisly', 'zbiornik-zeslawice', 'BULWARY WISŁY', 'water'],
  // renamed parks — same motif, new arc text
  ['las-borkowski', 'las-borkowski', 'PARK PRZY FORCIE BOREK', 'forest'],
  ['park-nad-rudawa', 'park-nad-rudawa', 'PARK RZECZNY RUDAWA', 'water'],
  ['park-nad-bialucha', 'park-nad-bialucha', 'PARK RZECZNY BIAŁUCHA', 'water'],
  ['park-nad-sudolem', 'park-nad-sudolem', 'PARK OGRÓD NAD SUDOŁEM', 'water'],
];

/** Arc text fit — same calibration as the original set. */
function fitText(text) {
  const narrow = new Set(['I', 'J', 'L', 'Ł', '.', ' ', '·', "'"]);
  const wide = new Set(['W', 'M']);
  let eff = 0;
  for (const ch of text) eff += narrow.has(ch) ? 0.5 : wide.has(ch) ? 0.95 : 0.75;
  const fontSize = Math.min(18, 214 / eff);
  return { fontSize: fontSize.toFixed(1), letterSpacing: (0.13 * fontSize).toFixed(2) };
}

const DEFS = `<defs><path id="aT" d="M 33 111.8 A 68 68 0 1 1 167 111.8"></path><filter id="rgh" x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"></feDisplacementMap></filter></defs>`;

let ok = 0;
for (const [slug, source, arcText, category] of JOBS) {
  const src = readFileSync(path.join(SVG_DIR, `${source}.svg`), 'utf8');
  // Motif = everything inside the filtered group, before the arc text.
  const m = src.match(/<g filter="url\(#rgh\)">\s*([\s\S]*?)<text /);
  if (!m) {
    console.error(`✗ ${slug}: motif not found in ${source}.svg`);
    continue;
  }
  const ink = INK[category];
  const motif = m[1].replace(/#(?:b04437|6f8153|4f7d99)/g, ink).trim();
  const { fontSize, letterSpacing } = fitText(arcText);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
${DEFS}
<g filter="url(#rgh)">
${motif}
<text font-family="Times New Roman,Times,serif" font-weight="700" fill="${ink}" stroke="${ink}" stroke-width="0.55" paint-order="stroke" font-size="${fontSize}" letter-spacing="${letterSpacing}"><textPath href="#aT" startOffset="50%" text-anchor="middle">${arcText}</textPath></text>
</g>
</svg>`;
  writeFileSync(path.join(SVG_DIR, `${slug}.svg`), svg);
  for (const [scale, suffix] of [
    [200, ''],
    [400, '@2x'],
    [600, '@3x'],
  ]) {
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: scale },
      font: { loadSystemFonts: true },
    }).render();
    writeFileSync(path.join(OUT_DIR, `${slug}${suffix}.png`), png.asPng());
  }
  ok++;
  console.log(`✓ ${slug}  (${arcText} · ${category}, motif: ${source})`);
}
console.log(`\n${ok}/${JOBS.length} stamp layers generated`);
