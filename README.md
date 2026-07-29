<div align="center">

<img src="assets/images/icon.png" alt="Kraków Park Explorer" width="160" />

# Kraków Park Explorer

**Plan visits and record your progress through all 78 parks in the *Odkrywca Krakowskich Parków* challenge.**

Offline-first · account-free · free in full · Polski / English

</div>

---

> [!IMPORTANT]
> **This is an unofficial, independent app.** It is not made, endorsed or operated by Zarząd Zieleni Miejskiej w Krakowie (ZZM), and it is not affiliated with them in any way.
>
> **Proof of a visit comes from a stamp physically pressed into your paper booklet.** The app keeps check-ins, photos, saved pins and digital stamps as personal records.

---

## What the challenge is

*Odkrywca Krakowskich Parków* ("Kraków Parks Explorer") is an open-ended city challenge run by ZZM, inspired by peak-bagging in the mountains. You visit 78 designated Kraków parks, find the wooden box in each one, and press its unique rubber stamp into a physical booklet. There is no deadline, no required order and no daily limit. Collect all 78 and you earn the *Odkrywca Krakowskich Parków* badge.

ZZM publishes the exact coordinates of each box together with the official park list. The app uses those published coordinates, so every park pin marks the box location itself.

<div align="center">
  <img src="assets/images/booklet.webp" alt="The official OKP booklet" width="420" />
  <br />
  <em>Pick up the official booklet from ZZM.</em>
</div>

## What the app does

**Explore.** All 78 parks on a map and in a searchable list, colour-coded by category, filterable by distance and by what you've already collected. Each park gets a detail screen with its history, a photo, and how to get there.

**Plan a route.** Pick a set of parks, or all the parks you have left, and the app orders them into an efficient trip using a travelling-salesman heuristic. Long routes are split into day-sized segments. Walking and cycling are supported. Tap Navigate on a leg and your phone's own maps app takes over; there's no turn-by-turn in here.

**Track your booklet.** Mark a park stamped, then add photos or a private note. The X/78 ring fills as you go, and each collected park unlocks a redrawn digital stamp. The app also awards category badges and celebrates milestones at 10, 25, 50 and 78 parks.

**Look back.** See your parks per month, visit calendar and longest streak. *Parks Wrapped* turns your visits and photos into shareable cards. The app calculates everything on your device and never compares your results with anyone else's.

<div align="center">
  <img src="assets/parks/planty-krakowskie.webp" alt="Planty Krakowskie" width="30%" />
  <img src="assets/parks/zalew-nowohucki.webp" alt="Zalew Nowohucki" width="30%" />
  <img src="assets/parks/park-zakrzowek.webp" alt="Zakrzówek" width="30%" />
  <br />
  <img src="assets/parks/park-decjusza.webp" alt="Park Decjusza" width="30%" />
  <img src="assets/parks/las-wolski.webp" alt="Las Wolski" width="30%" />
  <img src="assets/parks/park-im-henryka-jordana.webp" alt="Park im. Henryka Jordana" width="30%" />
</div>

## Principles

The app is **offline-capable and account-free**. There is no sign-up, no login and no server holding your data. Park data, descriptions and all 78 stamp illustrations ship inside the app; your progress, notes and photos live on your device and nowhere else. Only route generation needs a network connection.

There are **no paid features**, no ads, no analytics tied to you, no leaderboards and no social feed. The app uses your location while you find nearby parks or plan routes. It does not track your location in the background unless you turn that on.

The digital stamps use **original artwork** inspired by the challenge's category colours.

## Tech

Expo (SDK 57) and React Native, with Expo Router for navigation, Zustand for state, MapLibre over OpenStreetMap tiles for maps, and `react-native-svg` plus core `Animated` for the stamp artwork and motion. Everything ships in Polish and English.

```bash
npm install
npx expo start      # then press i / a, or scan the QR code
```

`npm run ios` and `npm run android` build the native projects directly.

## Attribution

Park data is derived from the official booklet list and enriched from **OpenStreetMap** (© OpenStreetMap contributors, ODbL). Basemap tiles come from OpenFreeMap. Park photographs are credited individually in `assets/parks/attribution.json`, and that credit is displayed in the app on every photo. Fonts are Caprasimo and Figtree via Google Fonts.

If you are ZZM and would like something here changed or removed, please open an issue and I'll take care of it.

## Licence

[MIT](LICENSE) © Wojciech Dróżdż. The licence covers this source code; it does not extend to third-party photographs, ZZM's branding, or the official booklet.
