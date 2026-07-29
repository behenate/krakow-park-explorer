import { Language } from '@/i18n/translations';
import { CategoryId } from '@/theme/tokens';

/** Park prose in every supported UI language. */
export type LocalizedText = Record<Language, string>;

/**
 * The official 78-park list (OKP list revision 2026-07, coordinates as
 * published — converted from DMS by scripts/official-list.mjs). Park `id`
 * === stamp artwork slug; categories follow each stamp's ink colour.
 */
export interface Park {
  id: string;
  name: string;
  category: CategoryId;
  lat: number;
  lng: number;
  history: LocalizedText;
  access: LocalizedText;
  entrances: number;
}

type Row = [slug: string, name: string, category: CategoryId, lat: number, lng: number];

const rows: Row[] = [
  // ---- grouped as published; category = stamp ink ----
  ['fort-mistrzejowice', 'Fort Mistrzejowice', 'historical', 50.1009, 20.0173],
  ['park-fort-2-kosciuszko', 'Park Fort 2 Kościuszko', 'historical', 50.0542, 19.8929],
  ['park-szwedzki', 'Park Szwedzki', 'historical', 50.0748, 20.0443],
  ['park-ratuszowy', 'Park Ratuszowy', 'historical', 50.0755, 20.0393],
  ['park-klasztorna', 'Park Klasztorna', 'forest', 50.0667, 20.0506],
  ['park-im-stefana-zeromskiego', 'Park im. Stefana Żeromskiego', 'historical', 50.0668, 20.0422],
  ['park-wadow', 'Park Wadów', 'historical', 50.0999, 20.1254],
  ['park-jana-matejki', 'Park Jana Matejki', 'forest', 50.0813, 20.0543],
  ['park-tysiaclecia', 'Park Tysiąclecia', 'historical', 50.0892, 19.9984],
  ['fort-batowice', 'Fort Batowice', 'historical', 50.0996, 19.9984],
  ['park-lotnikow-polskich', 'Park Lotników Polskich', 'historical', 50.0671, 19.9953],
  ['planty-nowackiego', 'Planty im. Floriana Nowackiego', 'forest', 50.0437, 19.9423],
  ['park-stacja-wisla', 'Park Stacja Wisła', 'historical', 50.051, 19.9599],
  ['park-im-wojciecha-bednarskiego', 'Park im. Wojciecha Bednarskiego', 'historical', 50.0416, 19.9503],
  ['park-przy-dworze-czeczow', 'Park przy Dworze Czeczów', 'forest', 50.0144, 20.0397],
  ['park-jerzmanowskich', 'Park im. Anny i Erazma Jerzmanowskich', 'historical', 50.018, 19.9951],
  ['park-sw-wincentego-a-paulo', 'Park św. Wincentego a\'Paulo', 'historical', 50.0711, 19.9117],
  ['park-duchacki', 'Park Duchacki', 'historical', 50.0216, 19.9652],
  ['park-decjusza', 'Park Decjusza', 'historical', 50.0659, 19.8718],
  ['blonia-krakowskie', 'Błonia Krakowskie', 'forest', 50.0593, 19.9229],
  ['park-fort-bronowice', 'Park przy Forcie Bronowice', 'historical', 50.0817, 19.9001],
  ['park-krakowski-im-marka-grechuty', 'Park Krakowski im. Marka Grechuty', 'historical', 50.0671, 19.9243],
  ['park-ogrod-lobzow', 'Park Ogród Łobzów', 'forest', 50.0754, 19.9102],
  ['park-kleparski', 'Park Kleparski', 'historical', 50.0763, 19.9378],
  ['park-im-henryka-jordana', 'Park im. Henryka Jordana', 'historical', 50.0609, 19.9177],
  ['park-solvay', 'Park Solvay', 'historical', 50.0183, 19.9279],
  ['park-im-tadeusza-kosciuszki', 'Park im. Tadeusza Kościuszki', 'historical', 50.0934, 19.9402],
  ['park-im-stanislawa-wyspianskiego', 'Park im. Stanisława Wyspiańskiego', 'historical', 50.0859, 19.9207],
  ['park-zaczarowanej-dorozki', 'Park Zaczarowanej Dorożki', 'historical', 50.0873, 19.9664],
  ['park-reduta', 'Park Reduta', 'historical', 50.0967, 19.9872],
  ['park-kolejowy', 'Park Kolejowy', 'forest', 50.0597, 19.9477],
  ['park-strzelecki', 'Park Strzelecki', 'historical', 50.0665, 19.9505],
  ['park-jalu-kurka', 'Park Jalu Kurka', 'historical', 50.0693, 19.9416],
  ['planty-krakowskie', 'Planty Krakowskie', 'historical', 50.0653, 19.9409],
  ['park-im-wislawy-szymborskiej', 'Park im. Wisławy Szymborskiej', 'historical', 50.0654, 19.929],

  ['park-kurczaba', 'Park Kurczaba', 'water', 50.0129, 20.0051],
  ['park-wisniowy-sad', 'Park Wiśniowy Sad', 'forest', 50.0763, 20.0271],
  ['park-kultury', 'Park Kultury', 'forest', 50.0711, 20.0336],
  ['park-wegrzynowice', 'Park Węgrzynowice', 'forest', 50.1138, 20.1546],
  ['park-zielony-jar', 'Park Zielony Jar Wandy', 'forest', 50.0949, 20.0588],
  ['park-luczanowice', 'Park Łuczanowice', 'forest', 50.1082, 20.1131],
  ['planty-bienczyckie', 'Planty Bieńczyckie', 'forest', 50.0848, 20.0265],
  ['planty-mistrzejowickie', 'Planty Mistrzejowickie', 'forest', 50.0959, 20.0071],
  ['park-skalskiego', 'Park gen. Stanisława Skalskiego', 'forest', 50.0847, 20.0072],
  ['park-woznicow', 'Park Woźniców', 'forest', 50.0651, 20.0135],
  ['park-czyzyny', 'Park Czyżyny', 'forest', 50.0795, 20.0014],
  ['park-ogrod-plaszow', 'Park Rzeczny Ogród Płaszów', 'forest', 50.0466, 19.9936],
  ['park-aleksandry-polnoc', 'Park Aleksandry Północ', 'forest', 50.0177, 20.0118],
  ['park-lilli-wenedy', 'Park Lilli Wenedy', 'forest', 50.0208, 20.0044],
  ['park-aleksandry', 'Park Aleksandry', 'forest', 50.0117, 20.0139],
  ['park-rzaka', 'Park Rżąka', 'forest', 50.0083, 20.0081],
  ['park-zlocien', 'Park Złocień', 'forest', 50.0102, 20.0397],
  ['park-kurdwanow', 'Park Kurdwanów', 'forest', 50.0098, 19.9607],
  ['las-borkowski', 'Park przy Forcie Borek', 'forest', 50.0004, 19.9057],
  ['park-macka-i-doroty', 'Park Maćka i Doroty', 'forest', 50.0024, 19.9123],
  ['park-pychowicki', 'Park Pychowicki', 'forest', 50.0304, 19.8939],
  ['park-linearny-ruczaj', 'Park Linearny Ruczaj', 'water', 50.0283, 19.9099],
  ['park-przy-ul-radzikowskiego', 'Park przy ul. Radzikowskiego', 'water', 50.0868, 19.887],
  ['park-przy-ul-lokietka', 'Park przy ul. Łokietka', 'water', 50.0807, 19.9279],
  ['park-lagiewnicki', 'Park Łagiewnicki', 'water', 50.0234, 19.9448],
  ['park-krowoderski', 'Park Krowoderski', 'forest', 50.0897, 19.922],

  ['przylasek-rusiecki', 'Park Przylasek Rusiecki', 'water', 50.0464, 20.1583],
  ['przylasek-wyciaski', 'Park Przylasek Wyciąski', 'water', 50.0559, 20.1807],
  ['zalew-nowohucki', 'Park Zalew Nowohucki', 'water', 50.0797, 20.0534],
  ['park-bagry-wielkie', 'Park Bagry Wielkie', 'water', 50.0346, 19.9909],
  ['staw-plaszowski', 'Park Staw Płaszowski', 'water', 50.0412, 19.9726],
  ['park-rzeczny-drwinka', 'Park Rzeczny Drwinka', 'water', 50.0146, 19.9797],
  ['park-zakrzowek', 'Park Zakrzówek', 'water', 50.0338, 19.9083],
  ['park-debnicki', 'Park Dębnicki', 'water', 50.0491, 19.9169],
  ['park-nad-rudawa', 'Park Rzeczny Rudawa', 'water', 50.0711, 19.8682],
  ['park-mlynowka-krolewska', 'Park Młynówka Królewska', 'water', 50.0791, 19.8574],
  ['park-rzeczny-tetmajera', 'Park Rzeczny im. Włodzimierza Tetmajera', 'water', 50.0948, 19.8658],
  ['park-rzeczny-wilga', 'Park Rzeczny Wilga', 'water', 50.028, 19.9271],
  ['park-nad-bialucha', 'Park Rzeczny Białucha', 'water', 50.0827, 19.9573],
  ['park-nad-sudolem', 'Park Ogród nad Sudołem', 'water', 50.0906, 19.9692],
  ['park-dabie', 'Park Dąbie', 'water', 50.0566, 19.9794],
  ['park-grzegorzecki', 'Park Grzegórzecki', 'water', 50.0551, 19.9657],
  ['bulwary-wisly', 'Bulwary Wisły', 'water', 50.0522, 19.9339],
];

const detailed: Record<string, { history: LocalizedText; access: LocalizedText; entrances: number }> = {
  'park-im-wojciecha-bednarskiego': {
    history: {
      en: "Founded in 1896 by Wojciech Bednarski inside a former quarry — one of Europe's first parks reclaimed from industrial ground.",
      pl: 'Założony w 1896 r. przez Wojciecha Bednarskiego w dawnym kamieniołomie — jeden z pierwszych w Europie parków na terenie poprzemysłowym.',
      uk: 'Заснований 1896 року Войцехом Беднарським у колишньому каменярні — один із перших у Європі парків, відвойованих у промислової землі.',
    },
    access: {
      en: '3 entrances · Tram to "Korona"; steep paths from the Podgórze side.',
      pl: '3 wejścia · Tramwaj do „Korony”; strome ścieżki od strony Podgórza.',
      uk: '3 входи · Трамваєм до «Korona»; круті стежки з боку Подґужа.',
    },
    entrances: 3,
  },
  'zalew-nowohucki': {
    history: {
      en: "Dug as a flood reservoir for the young Nowa Huta in 1957, the lagoon slowly turned from concrete basin into the district's beloved swimming-and-picnic shore.",
      pl: 'Wykopany w 1957 r. jako zbiornik przeciwpowodziowy młodej Nowej Huty; z betonowej niecki powoli stał się ukochanym kąpieliskiem i miejscem pikników dzielnicy.',
      uk: 'Викопаний 1957 року як протипаводковий резервуар для молодої Нової Гути, згодом із бетонної чаші поволі перетворився на улюблене місце купання та пікніків усього району.',
    },
    access: {
      en: '2 entrances · Tram 4, 10 → "Struga"; step-free path along the north shore.',
      pl: '2 wejścia · Tramwaj 4, 10 → „Struga”; ścieżka bez schodów wzdłuż północnego brzegu.',
      uk: '2 входи · Трамваї 4, 10 → «Struga»; стежка без сходів уздовж північного берега.',
    },
    entrances: 2,
  },
  'park-im-henryka-jordana': {
    history: {
      en: "Established in 1889 by Dr Henryk Jordan as Europe's first public playground-park — a revolutionary idea that exercise belongs to every child.",
      pl: 'Założony w 1889 r. przez dr. Henryka Jordana jako pierwszy w Europie publiczny park zabaw — rewolucyjna idea ruchu dla każdego dziecka.',
      uk: 'Заснований 1889 року доктором Генриком Йорданом як перший у Європі публічний парк для дитячих ігор — революційна на той час думка, що рух належить кожній дитині.',
    },
    access: {
      en: '4 entrances · Tram → "Park Jordana"; flat, fully accessible paths.',
      pl: '4 wejścia · Tramwaj → „Park Jordana”; płaskie, w pełni dostępne alejki.',
      uk: '4 входи · Трамваєм → «Park Jordana»; рівні, повністю доступні алеї.',
    },
    entrances: 4,
  },
};

function defaultContent(name: string, category: CategoryId) {
  const en = {
    historical: `A green witness to Kraków's layered past — ${name} keeps the city's history under its old trees.`,
    forest: `A pocket of woodland calm where ${name} lets the city fall quiet among the trunks.`,
    water: `Shaped by water, ${name} gathers the neighbourhood on its banks in every season.`,
  }[category];
  const pl = {
    historical: `Zielony świadek wielowarstwowej przeszłości Krakowa — ${name} chroni historię miasta pod starymi drzewami.`,
    forest: `Kieszeń leśnego spokoju: w ${name} miasto cichnie między pniami.`,
    water: `Ukształtowany przez wodę ${name} w każdą porę roku gromadzi sąsiadów na swoich brzegach.`,
  }[category];
  const uk = {
    historical: `Зелений свідок багатошарового минулого Кракова — ${name} береже історію міста під старими деревами.`,
    forest: `Кишенька лісового спокою: у ${name} місто стихає поміж стовбурів.`,
    water: `Сформований водою, ${name} щопори року збирає сусідів на своїх берегах.`,
  }[category];
  return {
    history: { en, pl, uk },
    access: {
      en: '2 entrances · check the mini-map for the nearest one.',
      pl: '2 wejścia · sprawdź najbliższe na mini-mapie.',
      uk: '2 входи · знайди найближчий на міні-карті.',
    },
    entrances: 2,
  };
}

/**
 * Park descriptions condensed from the official ZZM pages
 * (zzm.krakow.pl/zzm/parki.html) — see scripts/fetch-zzm-photos.mjs for the
 * matching photo pipeline. Overrides the generic fallback text when present.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parkStories: Record<string, LocalizedText> = require('./parkStories.json');

export const parks: Park[] = rows.map(([id, name, category, lat, lng]) => {
  const extra = detailed[id] ?? defaultContent(name, category);
  const story = parkStories[id];
  return { id, name, category, lat, lng, ...extra, ...(story ? { history: story } : {}) };
});

export const TOTAL_PARKS = parks.length; // 78

export function parkById(id: string): Park | undefined {
  return parks.find((p) => p.id === id);
}

/** Haversine distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Default viewpoint: Kraków main square-ish, used when location is unavailable. */
export const KRAKOW_CENTER = { lat: 50.0619, lng: 19.9368 };
