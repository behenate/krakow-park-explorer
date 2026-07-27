/**
 * Rasterize the stamp layer SVGs (repo-root assets/stamps/layers) into the
 * app bundle at 1x/2x/3x (200/400/600 px). resvg handles <textPath> and the
 * feTurbulence ink filter (librsvg drops the former, react-native-svg can't
 * run the latter); sharp then encodes WebP — noticeably smaller than PNG and
 * fast to decode on both platforms.
 *
 * Run from parko/:  node scripts/rasterize-stamps.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const SRC = '../assets/stamps/layers';
const OUT = 'assets/stamps/layers';
const SCALES = [
  [200, ''],
  [400, '@2x'],
  [600, '@3x'],
];
const WEBP = { quality: 82, alphaQuality: 90, effort: 5 };

mkdirSync(OUT, { recursive: true });

// Collect [name, svgPath]: base plates, unvisited overlays, park layers.
const jobs = [];
for (const dir of ['base', 'unvisited', 'parks']) {
  for (const f of readdirSync(path.join(SRC, dir))) {
    if (f.endsWith('.svg')) jobs.push([f.replace('.svg', ''), path.join(SRC, dir, f)]);
  }
}

// Clear previous rasters so removed layers don't linger.
for (const f of readdirSync(OUT)) {
  if (/\.(png|webp)$/.test(f)) rmSync(path.join(OUT, f));
}

let total = 0;
for (const [name, svgPath] of jobs) {
  const svg = readFileSync(svgPath, 'utf8');
  for (const [width, suffix] of SCALES) {
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
      font: { loadSystemFonts: true },
    })
      .render()
      .asPng();
    const webp = await sharp(png).webp(WEBP).toBuffer();
    writeFileSync(path.join(OUT, `${name}${suffix}.webp`), webp);
  }
  total++;
}
console.log(`${total} layers × ${SCALES.length} scales rasterized to WebP in ${OUT}`);
