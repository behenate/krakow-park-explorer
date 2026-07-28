/** Central app config — external contacts and links. */

// Basemap style lives in src/lib/mapStyle.ts (Organic palette over
// OpenFreeMap's OSM tiles); swap its source URLs to the self-hosted Kraków
// PMTiles per the routing backend plan for a fully offline basemap.

export const ZZM = {
  /** TODO: confirm the exact OKP contact address before release (site obfuscates it). */
  email: 'sekretariat@zzm.krakow.pl',
  phone: '(12) 20-10-241',
  okpUrl: 'https://zzm.krakow.pl/okp.html',
};

/** This app's open-source repository. */
export const GITHUB_URL = 'https://github.com/behenate/krakow-park-explorer';

/** Booklet distribution points (spec 4.5). */
export const DISTRIBUTION_POINTS = [
  {
    id: 'dist-symbioza',
    name: 'CEE "Symbioza"',
    lat: 50.0596,
    lng: 19.8548,
    mapsUrl: 'https://maps.app.goo.gl/LEXq6FEaeoUXEHhS9',
  },
  {
    id: 'dist-fabryczna',
    name: 'Pawilon — Park Kieszonkowy Fabryczna',
    lat: 50.0678,
    lng: 19.9739,
    mapsUrl: 'https://maps.app.goo.gl/1nnwqPaKeFTn5BCR9',
  },
] as const;
