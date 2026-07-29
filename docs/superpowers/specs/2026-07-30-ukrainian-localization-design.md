# Ukrainian localization — design

**Date:** 2026-07-30
**Status:** approved

## Goal

Add Ukrainian (`uk`) as a third app language alongside English and Polish, covering UI
chrome, park prose, date formatting, and native (iOS/Android) app metadata.

Ukrainian speakers are the largest non-Polish-speaking group in Kraków, and the park
challenge is a city-wide public activity aimed at residents.

## Scope decisions

Two decisions were settled before design, because each materially changes the work:

1. **Park prose is translated**, not fallen back. The 49 entries in `parkStories.json`
   and the `history`/`access` pairs for the 8 detailed parks in `parks.ts` all gain a
   `uk` field.
2. **Stamp artwork reuses the English plates.** The stamp language text is baked into
   rasterized WebP layers (`✦ KRAKÓW · FOREST ✦`, `NOT YET DISCOVERED`), generated from
   SVGs that live outside this repo. Rather than add 36 Ukrainian image files, `uk`
   renders the existing English plates.

## Architecture

### Language plumbing

`Language` is derived from the keys of `translations`, so adding a `uk` block widens the
type everywhere automatically. Three places need widening by hand:

- `Settings.language` in `src/store/index.ts` — the persisted setting, `'system' | 'en' | 'pl' | 'uk'`.
- `systemLanguage()` in `src/i18n/index.tsx`.
- The duplicate of that logic in `src/lib/followingLocation.ts`, which resolves the
  language outside React for background tasks.

Instead of adding a third `code === 'uk'` ternary, the device-code-to-`Language` mapping
is extracted into one exported helper:

```ts
export function resolveLanguage(setting: Settings['language']): Language
```

Both call sites use it. `expo-localization`'s `getLocales()[0].languageCode` returns a
BCP 47 language code without region (`'uk'` for any Ukrainian regional variant), so a
direct key lookup against `translations` is sufficient — no tag parsing needed.

The existing `t()` fallback chain (`uk → en → key`) already covers any missing key.

### Date formatting

Five call sites hardcode `lang === 'pl' ? 'pl-PL' : 'en-GB'`: `stamp-viewer.tsx`,
`(tabs)/settings.tsx`, `park/[id].tsx`, `(tabs)/booklet.tsx`, `TripPicker.tsx`. A
`localeTag(lang)` helper lives next to `resolveLanguage()` and returns the BCP 47 tag
(`pl-PL` / `en-GB` / `uk-UA`). All five sites call it.

The A–Z sort in `(tabs)/index.tsx` keeps its `localeCompare(…, 'pl')` collation: park
names are Polish regardless of the UI language.

### Stamp art

`StampLang` stays `'pl' | 'en'`. A `stampLang(lang: Language): StampLang` mapper folds
`uk → en` at the single call site in `StampView.tsx`. No new assets.

### Park content

`history` and `access` in `parks.ts`, and each entry in `parkStories.json`, gain a `uk`
field. Lookup in `park/[id].tsx` becomes an indexed read with an English fallback
(`park.history[lang] ?? park.history.en`) rather than a `pl`/`en` ternary.

### Language pickers

- **Settings** cycles `system → pl → en → uk`. The label logic moves to a shared
  `LANGUAGE_LABELS` map so the "System default (X)" case resolves for all three.
- **Onboarding** currently binary-toggles EN/PL; it becomes a three-way cycle over the
  same order.

### Native metadata

`locales/uk.json` mirrors the flat shape already used by `locales/pl.json` (display name
plus the four permission strings) and is registered under `expo.locales` in `app.json`.
The repo's existing flat format is kept rather than migrating to the newer nested
`{ios, android}` shape, so Polish and Ukrainian stay consistent.

## Testing

The project has no test suite. Verification is:

- `npx tsc --noEmit` — catches any key missing from the `uk` block, since
  `TranslationKey` is derived from `en` and the blocks are structurally compared.
- `npm run lint`.
- A one-off assertion that the `uk` key set equals the `en` key set.

## Known limitation

The Ukrainian text is authored by Claude, not a native speaker. The UI strings are short
and high-confidence; the ~45 KB of park prose warrants a native-speaker review pass
before release. This is noted in the commit rather than presented as ship-final.

"Wrapped" stays untranslated as branding, matching the Polish treatment.
