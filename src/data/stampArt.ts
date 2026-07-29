import { ImageSourcePropType } from 'react-native';

import { Language } from '@/i18n/translations';

/**
 * AUTO-GENERATED layered stamp assets (base plates + park layers + unvisited
 * overlays), rasterized from assets/stamps/layers/*.svg by
 * scripts/rasterize-stamps.mjs at 1x/2x/3x as WebP (smaller + faster than
 * PNG; resvg handles <textPath> and the feTurbulence ink filter). Layers
 * share a 200pt frame and stack pixel-perfectly.
 */

/**
 * Only two sets of plates exist — the kind text is baked into the art. Other
 * UI languages borrow the English plates.
 */
export type StampLang = 'pl' | 'en';

export function stampLang(lang: Language): StampLang {
  return lang === 'pl' ? 'pl' : 'en';
}

export const basePlates: Record<string, ImageSourcePropType> = {
  'historical-pl': require('../../assets/stamps/layers/base-historical-pl.webp'),
  'historical-en': require('../../assets/stamps/layers/base-historical-en.webp'),
  'forest-pl': require('../../assets/stamps/layers/base-forest-pl.webp'),
  'forest-en': require('../../assets/stamps/layers/base-forest-en.webp'),
  'water-pl': require('../../assets/stamps/layers/base-water-pl.webp'),
  'water-en': require('../../assets/stamps/layers/base-water-en.webp'),
};

export const unvisitedOverlays: Record<string, ImageSourcePropType> = {
  'historical-pl': require('../../assets/stamps/layers/unvisited-historical-pl.webp'),
  'historical-en': require('../../assets/stamps/layers/unvisited-historical-en.webp'),
  'forest-pl': require('../../assets/stamps/layers/unvisited-forest-pl.webp'),
  'forest-en': require('../../assets/stamps/layers/unvisited-forest-en.webp'),
  'water-pl': require('../../assets/stamps/layers/unvisited-water-pl.webp'),
  'water-en': require('../../assets/stamps/layers/unvisited-water-en.webp'),
};

export const parkLayers: Record<string, ImageSourcePropType> = {
  'blonia-krakowskie': require('../../assets/stamps/layers/blonia-krakowskie.webp'),
  'bulwary-wisly': require('../../assets/stamps/layers/bulwary-wisly.webp'),
  'fort-batowice': require('../../assets/stamps/layers/fort-batowice.webp'),
  'fort-mistrzejowice': require('../../assets/stamps/layers/fort-mistrzejowice.webp'),
  'las-borkowski': require('../../assets/stamps/layers/las-borkowski.webp'),
  'park-aleksandry': require('../../assets/stamps/layers/park-aleksandry.webp'),
  'park-aleksandry-polnoc': require('../../assets/stamps/layers/park-aleksandry-polnoc.webp'),
  'park-bagry-wielkie': require('../../assets/stamps/layers/park-bagry-wielkie.webp'),
  'park-czyzyny': require('../../assets/stamps/layers/park-czyzyny.webp'),
  'park-dabie': require('../../assets/stamps/layers/park-dabie.webp'),
  'park-debnicki': require('../../assets/stamps/layers/park-debnicki.webp'),
  'park-decjusza': require('../../assets/stamps/layers/park-decjusza.webp'),
  'park-duchacki': require('../../assets/stamps/layers/park-duchacki.webp'),
  'park-fort-2-kosciuszko': require('../../assets/stamps/layers/park-fort-2-kosciuszko.webp'),
  'park-fort-bronowice': require('../../assets/stamps/layers/park-fort-bronowice.webp'),
  'park-grzegorzecki': require('../../assets/stamps/layers/park-grzegorzecki.webp'),
  'park-im-henryka-jordana': require('../../assets/stamps/layers/park-im-henryka-jordana.webp'),
  'park-im-stanislawa-wyspianskiego': require('../../assets/stamps/layers/park-im-stanislawa-wyspianskiego.webp'),
  'park-im-stefana-zeromskiego': require('../../assets/stamps/layers/park-im-stefana-zeromskiego.webp'),
  'park-im-tadeusza-kosciuszki': require('../../assets/stamps/layers/park-im-tadeusza-kosciuszki.webp'),
  'park-im-wislawy-szymborskiej': require('../../assets/stamps/layers/park-im-wislawy-szymborskiej.webp'),
  'park-im-wojciecha-bednarskiego': require('../../assets/stamps/layers/park-im-wojciecha-bednarskiego.webp'),
  'park-jalu-kurka': require('../../assets/stamps/layers/park-jalu-kurka.webp'),
  'park-jana-matejki': require('../../assets/stamps/layers/park-jana-matejki.webp'),
  'park-jerzmanowskich': require('../../assets/stamps/layers/park-jerzmanowskich.webp'),
  'park-klasztorna': require('../../assets/stamps/layers/park-klasztorna.webp'),
  'park-kleparski': require('../../assets/stamps/layers/park-kleparski.webp'),
  'park-kolejowy': require('../../assets/stamps/layers/park-kolejowy.webp'),
  'park-krakowski-im-marka-grechuty': require('../../assets/stamps/layers/park-krakowski-im-marka-grechuty.webp'),
  'park-krowoderski': require('../../assets/stamps/layers/park-krowoderski.webp'),
  'park-kultury': require('../../assets/stamps/layers/park-kultury.webp'),
  'park-kurczaba': require('../../assets/stamps/layers/park-kurczaba.webp'),
  'park-kurdwanow': require('../../assets/stamps/layers/park-kurdwanow.webp'),
  'park-lagiewnicki': require('../../assets/stamps/layers/park-lagiewnicki.webp'),
  'park-lilli-wenedy': require('../../assets/stamps/layers/park-lilli-wenedy.webp'),
  'park-linearny-ruczaj': require('../../assets/stamps/layers/park-linearny-ruczaj.webp'),
  'park-lotnikow-polskich': require('../../assets/stamps/layers/park-lotnikow-polskich.webp'),
  'park-luczanowice': require('../../assets/stamps/layers/park-luczanowice.webp'),
  'park-macka-i-doroty': require('../../assets/stamps/layers/park-macka-i-doroty.webp'),
  'park-mlynowka-krolewska': require('../../assets/stamps/layers/park-mlynowka-krolewska.webp'),
  'park-nad-bialucha': require('../../assets/stamps/layers/park-nad-bialucha.webp'),
  'park-nad-rudawa': require('../../assets/stamps/layers/park-nad-rudawa.webp'),
  'park-nad-sudolem': require('../../assets/stamps/layers/park-nad-sudolem.webp'),
  'park-ogrod-lobzow': require('../../assets/stamps/layers/park-ogrod-lobzow.webp'),
  'park-ogrod-plaszow': require('../../assets/stamps/layers/park-ogrod-plaszow.webp'),
  'park-przy-dworze-czeczow': require('../../assets/stamps/layers/park-przy-dworze-czeczow.webp'),
  'park-przy-ul-lokietka': require('../../assets/stamps/layers/park-przy-ul-lokietka.webp'),
  'park-przy-ul-radzikowskiego': require('../../assets/stamps/layers/park-przy-ul-radzikowskiego.webp'),
  'park-pychowicki': require('../../assets/stamps/layers/park-pychowicki.webp'),
  'park-ratuszowy': require('../../assets/stamps/layers/park-ratuszowy.webp'),
  'park-reduta': require('../../assets/stamps/layers/park-reduta.webp'),
  'park-rzaka': require('../../assets/stamps/layers/park-rzaka.webp'),
  'park-rzeczny-drwinka': require('../../assets/stamps/layers/park-rzeczny-drwinka.webp'),
  'park-rzeczny-tetmajera': require('../../assets/stamps/layers/park-rzeczny-tetmajera.webp'),
  'park-rzeczny-wilga': require('../../assets/stamps/layers/park-rzeczny-wilga.webp'),
  'park-skalskiego': require('../../assets/stamps/layers/park-skalskiego.webp'),
  'park-solvay': require('../../assets/stamps/layers/park-solvay.webp'),
  'park-stacja-wisla': require('../../assets/stamps/layers/park-stacja-wisla.webp'),
  'park-strzelecki': require('../../assets/stamps/layers/park-strzelecki.webp'),
  'park-sw-wincentego-a-paulo': require('../../assets/stamps/layers/park-sw-wincentego-a-paulo.webp'),
  'park-szwedzki': require('../../assets/stamps/layers/park-szwedzki.webp'),
  'park-tysiaclecia': require('../../assets/stamps/layers/park-tysiaclecia.webp'),
  'park-wadow': require('../../assets/stamps/layers/park-wadow.webp'),
  'park-wegrzynowice': require('../../assets/stamps/layers/park-wegrzynowice.webp'),
  'park-wisniowy-sad': require('../../assets/stamps/layers/park-wisniowy-sad.webp'),
  'park-woznicow': require('../../assets/stamps/layers/park-woznicow.webp'),
  'park-zaczarowanej-dorozki': require('../../assets/stamps/layers/park-zaczarowanej-dorozki.webp'),
  'park-zakrzowek': require('../../assets/stamps/layers/park-zakrzowek.webp'),
  'park-zielony-jar': require('../../assets/stamps/layers/park-zielony-jar.webp'),
  'park-zlocien': require('../../assets/stamps/layers/park-zlocien.webp'),
  'planty-bienczyckie': require('../../assets/stamps/layers/planty-bienczyckie.webp'),
  'planty-krakowskie': require('../../assets/stamps/layers/planty-krakowskie.webp'),
  'planty-mistrzejowickie': require('../../assets/stamps/layers/planty-mistrzejowickie.webp'),
  'planty-nowackiego': require('../../assets/stamps/layers/planty-nowackiego.webp'),
  'przylasek-rusiecki': require('../../assets/stamps/layers/przylasek-rusiecki.webp'),
  'przylasek-wyciaski': require('../../assets/stamps/layers/przylasek-wyciaski.webp'),
  'staw-plaszowski': require('../../assets/stamps/layers/staw-plaszowski.webp'),
  'zalew-nowohucki': require('../../assets/stamps/layers/zalew-nowohucki.webp'),
};
