/**
 * One-shot helper: converts the official OKP park list (DMS coordinates as
 * published) into the parks.ts rows block. Kept in the repo as the source of
 * truth for the list revision of 2026-07.
 *
 * Run: node scripts/official-list.mjs   → prints the rows arrays.
 */

// [slug, display name, category, DMS lat, DMS lng]  (Złocień: address only —
// approximate decimal coords for ul. Mariana Domagały provided directly)
const LIST = [
  ['fort-mistrzejowice', 'Fort Mistrzejowice', 'historical', `50°06'03.2"N`, `20°01'02.1"E`],
  ['park-kurczaba', 'Park Kurczaba', 'forest', `50°00'46.6"N`, `20°00'18.2"E`],
  ['park-fort-2-kosciuszko', 'Park Fort 2 Kościuszko', 'historical', `50°03'15.1"N`, `19°53'34.3"E`],
  ['przylasek-rusiecki', 'Park Przylasek Rusiecki', 'water', `50°02'47.0"N`, `20°09'29.8"E`],
  ['przylasek-wyciaski', 'Park Przylasek Wyciąski', 'water', `50°03'21.2"N`, `20°10'50.4"E`],
  ['park-wisniowy-sad', 'Park Wiśniowy Sad', 'forest', `50°04'34.6"N`, `20°01'37.4"E`],
  ['park-szwedzki', 'Park Szwedzki', 'historical', `50°04'29.1"N`, `20°02'39.3"E`],
  ['park-ratuszowy', 'Park Ratuszowy', 'historical', `50°04'31.8"N`, `20°02'21.5"E`],
  ['park-kultury', 'Park Kultury', 'forest', `50°04'16.1"N`, `20°02'00.9"E`],
  ['park-klasztorna', 'Park Klasztorna', 'historical', `50°04'00.2"N`, `20°03'02.3"E`],
  ['park-im-stefana-zeromskiego', 'Park im. Stefana Żeromskiego', 'historical', `50°04'00.6"N`, `20°02'32.0"E`],
  ['park-wegrzynowice', 'Park Węgrzynowice', 'forest', `50°06'49.6"N`, `20°09'16.4"E`],
  ['park-zielony-jar', 'Park Zielony Jar Wandy', 'forest', `50°05'41.8"N`, `20°03'31.7"E`],
  ['park-wadow', 'Park Wadów', 'historical', `50°05'59.5"N`, `20°07'31.6"E`],
  ['park-jana-matejki', 'Park Jana Matejki', 'historical', `50°04'52.7"N`, `20°03'15.6"E`],
  ['park-luczanowice', 'Park Łuczanowice', 'forest', `50°06'29.7"N`, `20°06'47.3"E`],
  ['planty-bienczyckie', 'Planty Bieńczyckie', 'forest', `50°05'05.4"N`, `20°01'35.3"E`],
  ['zalew-nowohucki', 'Park Zalew Nowohucki', 'water', `50°04'46.9"N`, `20°03'12.1"E`],
  ['planty-mistrzejowickie', 'Planty Mistrzejowickie', 'forest', `50°05'45.2"N`, `20°00'25.4"E`],
  ['park-tysiaclecia', 'Park Tysiąclecia', 'historical', `50°05'21.3"N`, `19°59'54.1"E`],
  ['fort-batowice', 'Fort Batowice', 'historical', `50°05'58.6"N`, `19°59'54.1"E`],
  ['park-skalskiego', 'Park gen. Stanisława Skalskiego', 'forest', `50°05'04.9"N`, `20°00'25.8"E`],
  ['park-woznicow', 'Park Woźniców', 'forest', `50°03'54.4"N`, `20°00'48.7"E`],
  ['park-lotnikow-polskich', 'Park Lotników Polskich', 'historical', `50°04'01.7"N`, `19°59'42.9"E`],
  ['park-czyzyny', 'Park Czyżyny', 'forest', `50°04'46.3"N`, `20°00'05.0"E`],
  ['park-bagry-wielkie', 'Park Bagry Wielkie', 'water', `50°02'04.7"N`, `19°59'27.1"E`],
  ['planty-nowackiego', 'Planty im. Floriana Nowackiego', 'historical', `50°02'37.5"N`, `19°56'32.4"E`],
  ['staw-plaszowski', 'Park Staw Płaszowski', 'water', `50°02'28.3"N`, `19°58'21.3"E`],
  ['park-stacja-wisla', 'Park Stacja Wisła', 'historical', `50°03'03.5"N`, `19°57'35.8"E`],
  ['park-ogrod-plaszow', 'Park Rzeczny Ogród Płaszów', 'forest', `50°02'47.6"N`, `19°59'36.8"E`],
  ['park-im-wojciecha-bednarskiego', 'Park im. Wojciecha Bednarskiego', 'historical', `50°02'29.9"N`, `19°57'01.0"E`],
  ['park-aleksandry-polnoc', 'Park Aleksandry Północ', 'forest', `50°01'03.7"N`, `20°00'42.5"E`],
  ['park-lilli-wenedy', 'Park Lilli Wenedy', 'forest', `50°01'14.8"N`, `20°00'15.7"E`],
  ['park-aleksandry', 'Park Aleksandry', 'forest', `50°00'42.3"N`, `20°00'49.9"E`],
  ['park-rzaka', 'Park Rżąka', 'forest', `50°00'29.9"N`, `20°00'29.1"E`],
  ['park-przy-dworze-czeczow', 'Park przy Dworze Czeczów', 'historical', `50°00'51.7"N`, `20°02'22.9"E`],
  ['park-jerzmanowskich', 'Park im. Anny i Erazma Jerzmanowskich', 'historical', `50°01'04.8"N`, `19°59'42.4"E`],
  ['park-sw-wincentego-a-paulo', "Park św. Wincentego a'Paulo", 'historical', `50°04'16.1"N`, `19°54'42.3"E`],
  ['park-zlocien', 'Park Złocień', 'forest', null, null, 50.0102, 20.0397],
  ['park-rzeczny-drwinka', 'Park Rzeczny Drwinka', 'water', `50°00'52.7"N`, `19°58'46.8"E`],
  ['park-kurdwanow', 'Park Kurdwanów', 'forest', `50°00'35.3"N`, `19°57'38.4"E`],
  ['park-duchacki', 'Park Duchacki', 'historical', `50°01'17.9"N`, `19°57'54.6"E`],
  ['las-borkowski', 'Park przy Forcie Borek', 'forest', `50°00'01.6"N`, `19°54'20.7"E`],
  ['park-macka-i-doroty', 'Park Maćka i Doroty', 'forest', `50°00'08.5"N`, `19°54'44.3"E`],
  ['park-zakrzowek', 'Park Zakrzówek', 'water', `50°02'01.7"N`, `19°54'29.9"E`],
  ['park-pychowicki', 'Park Pychowicki', 'forest', `50°01'49.4"N`, `19°53'38.1"E`],
  ['park-debnicki', 'Park Dębnicki', 'water', `50°02'56.7"N`, `19°55'01.0"E`],
  ['park-linearny-ruczaj', 'Park Linearny Ruczaj', 'forest', `50°01'41.9"N`, `19°54'35.6"E`],
  ['park-nad-rudawa', 'Park Rzeczny Rudawa', 'water', `50°04'15.9"N`, `19°52'05.5"E`],
  ['park-decjusza', 'Park Decjusza', 'historical', `50°03'57.1"N`, `19°52'18.6"E`],
  ['blonia-krakowskie', 'Błonia Krakowskie', 'historical', `50°03'33.4"N`, `19°55'22.6"E`],
  ['park-mlynowka-krolewska', 'Park Młynówka Królewska', 'water', `50°04'44.8"N`, `19°51'26.5"E`],
  ['park-rzeczny-tetmajera', 'Park Rzeczny im. Włodzimierza Tetmajera', 'water', `50°05'41.4"N`, `19°51'56.7"E`],
  ['park-przy-ul-radzikowskiego', 'Park przy ul. Radzikowskiego', 'forest', `50°05'12.6"N`, `19°53'13.1"E`],
  ['park-fort-bronowice', 'Park przy Forcie Bronowice', 'historical', `50°04'54.0"N`, `19°54'00.3"E`],
  ['park-krakowski-im-marka-grechuty', 'Park Krakowski im. Marka Grechuty', 'historical', `50°04'01.5"N`, `19°55'27.6"E`],
  ['park-przy-ul-lokietka', 'Park przy ul. Łokietka', 'forest', `50°04'50.5"N`, `19°55'40.3"E`],
  ['park-ogrod-lobzow', 'Park Ogród Łobzów', 'historical', `50°04'31.5"N`, `19°54'36.7"E`],
  ['park-kleparski', 'Park Kleparski', 'historical', `50°04'34.6"N`, `19°56'16.2"E`],
  ['park-im-henryka-jordana', 'Park im. Henryka Jordana', 'historical', `50°03'39.1"N`, `19°55'03.8"E`],
  ['park-rzeczny-wilga', 'Park Rzeczny Wilga', 'water', `50°01'40.9"N`, `19°55'37.6"E`],
  ['park-solvay', 'Park Solvay', 'historical', `50°01'05.7"N`, `19°55'40.5"E`],
  ['park-lagiewnicki', 'Park Łagiewnicki', 'forest', `50°01'24.4"N`, `19°56'41.2"E`],
  ['park-krowoderski', 'Park Krowoderski', 'forest', `50°05'22.8"N`, `19°55'19.3"E`],
  ['park-im-tadeusza-kosciuszki', 'Park im. Tadeusza Kościuszki', 'historical', `50°05'36.4"N`, `19°56'24.8"E`],
  ['park-im-stanislawa-wyspianskiego', 'Park im. Stanisława Wyspiańskiego', 'historical', `50°05'09.1"N`, `19°55'14.6"E`],
  ['park-zaczarowanej-dorozki', 'Park Zaczarowanej Dorożki', 'historical', `50°05'14.2"N`, `19°57'59.0"E`],
  ['park-reduta', 'Park Reduta', 'historical', `50°05'48.0"N`, `19°59'14.0"E`],
  ['park-nad-bialucha', 'Park Rzeczny Białucha', 'water', `50°04'57.7"N`, `19°57'26.2"E`],
  ['park-nad-sudolem', 'Park Ogród nad Sudołem', 'water', `50°05'26.2"N`, `19°58'09.1"E`],
  ['park-kolejowy', 'Park Kolejowy', 'historical', `50°03'35.1"N`, `19°56'51.6"E`],
  ['park-strzelecki', 'Park Strzelecki', 'historical', `50°03'59.3"N`, `19°57'01.8"E`],
  ['park-dabie', 'Park Dąbie', 'water', `50°03'23.8"N`, `19°58'45.7"E`],
  ['park-grzegorzecki', 'Park Grzegórzecki', 'water', `50°03'18.5"N`, `19°57'56.7"E`],
  ['bulwary-wisly', 'Bulwary Wisły', 'water', `50°03'07.9"N`, `19°56'02.2"E`],
  ['park-jalu-kurka', 'Park Jalu Kurka', 'historical', `50°04'09.4"N`, `19°56'29.6"E`],
  ['planty-krakowskie', 'Planty Krakowskie', 'historical', `50°03'55.2"N`, `19°56'27.2"E`],
  ['park-im-wislawy-szymborskiej', 'Park im. Wisławy Szymborskiej', 'historical', `50°03'55.5"N`, `19°55'44.3"E`],
];

function dmsToDec(dms) {
  const m = dms.match(/(\d+)°(\d+)'([\d.]+)"/);
  return +(Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600).toFixed(4);
}

const byCat = { historical: [], forest: [], water: [] };
for (const [slug, name, cat, dmsLat, dmsLng, decLat, decLng] of LIST) {
  const lat = dmsLat ? dmsToDec(dmsLat) : decLat;
  const lng = dmsLng ? dmsToDec(dmsLng) : decLng;
  const escaped = name.replace(/'/g, "\\'");
  byCat[cat].push(`  ['${slug}', '${escaped}', '${cat}', ${lat}, ${lng}],`);
}
for (const cat of ['historical', 'forest', 'water']) {
  console.log(`  // ---- ${cat} (${byCat[cat].length}) ----`);
  for (const line of byCat[cat]) console.log(line);
}
console.log(`// total: ${LIST.length}`);
