import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { categories, ground } from '@/theme/tokens';

/**
 * Kraków Park Explorer basemap style — the Organic design palette applied to OpenFreeMap's
 * OSM vector tiles (layer structure derived from their Positron style).
 * When the self-hosted Kraków PMTiles server ships (routing backend plan),
 * only the `sources`/`glyphs`/`sprite` URLs change; colours stay.
 */

/** Kraków city bounding box [west, south, east, north] — camera hard limit. */
export const KRAKOW_BOUNDS: [number, number, number, number] = [19.77, 49.96, 20.24, 50.14];

// Palette derived from tokens: cream ground, tinted greens/blues, muted browns.
const c = {
  bg: ground.bg, // #f5ead8 cream
  park: categories.forest.tint, // #e1eecc
  wood: '#d5e5be',
  water: '#c7dde9', // deeper than water tint for contrast on cream
  residential: '#efe2cb',
  building: '#e7d8be',
  buildingOutline: '#dccbab',
  roadMinor: '#fbf5e9',
  roadCasing: '#ddccae',
  roadMajor: '#fffdf6',
  rail: '#d8c7a8',
  railDash: '#f3ead6',
  label: '#6f6353',
  labelHalo: 'rgba(245,234,216,0.85)',
  waterLabel: categories.water.deep, // #35586e
  boundary: '#c4b295',
};

const fontRegular = ['Noto Sans Regular'];
const fontItalic = ['Noto Sans Italic'];
const fontBold = ['Noto Sans Bold'];

export const parkoMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': c.bg } },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      filter: ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
      paint: { 'fill-color': c.park, 'fill-opacity': 0.85 },
    },
    {
      id: 'landcover_wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      minzoom: 10,
      filter: [
        'all',
        ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
        ['==', ['get', 'class'], 'wood'],
      ],
      paint: {
        'fill-color': c.wood,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 12, 0.9],
      },
    },
    {
      id: 'landcover_grass',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      minzoom: 10,
      filter: [
        'all',
        ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
        ['==', ['get', 'class'], 'grass'],
      ],
      paint: { 'fill-color': c.park, 'fill-opacity': 0.6 },
    },
    {
      id: 'landuse_residential',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      maxzoom: 16,
      filter: [
        'all',
        ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
        ['==', ['get', 'class'], 'residential'],
      ],
      paint: {
        'fill-color': c.residential,
        'fill-opacity': ['interpolate', ['exponential', 0.6], ['zoom'], 8, 0.7, 9, 0.5],
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: [
        'all',
        ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
        ['!=', ['get', 'brunnel'], 'tunnel'],
      ],
      paint: { 'fill-antialias': true, 'fill-color': c.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
      paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 3] },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-antialias': true,
        'fill-color': c.building,
        'fill-outline-color': c.buildingOutline,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 0.9],
      },
    },
    {
      id: 'highway_path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['==', ['get', 'class'], 'path'],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.roadMinor,
        'line-opacity': 0.9,
        'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 13, 1, 20, 8],
      },
    },
    {
      id: 'highway_minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 8,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.roadMinor,
        'line-opacity': 0.95,
        'line-width': ['interpolate', ['exponential', 1.55], ['zoom'], 13, 1.8, 20, 18],
      },
    },
    {
      id: 'highway_major_casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk'], true, false],
      ],
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': c.roadCasing,
        'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 10, 3, 20, 22],
      },
    },
    {
      id: 'highway_major_inner',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk'], true, false],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.roadMajor,
        'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 10, 2, 20, 19],
      },
    },
    {
      id: 'highway_major_subtle',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      maxzoom: 11,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk'], true, false],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.roadCasing, 'line-opacity': 0.7, 'line-width': 2 },
    },
    {
      id: 'highway_motorway_casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['==', ['get', 'class'], 'motorway'],
      ],
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': c.roadCasing,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5.8, 0, 6, 3, 20, 38],
      },
    },
    {
      id: 'highway_motorway_inner',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['==', ['get', 'class'], 'motorway'],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.roadMajor,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 4, 2, 6, 1.3, 20, 28],
      },
    },
    {
      id: 'railway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['==', ['get', 'class'], 'rail'],
      ],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': c.rail,
        'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 16, 3, 20, 7],
      },
    },
    {
      id: 'railway_dashline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['==', ['get', 'class'], 'rail'],
      ],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': c.railDash,
        'line-dasharray': [3, 3],
        'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 16, 2, 20, 6],
      },
    },
    {
      id: 'boundary_admin',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      minzoom: 8,
      filter: [
        'all',
        ['>=', ['get', 'admin_level'], 3],
        ['<=', ['get', 'admin_level'], 6],
        ['!=', ['get', 'maritime'], 1],
      ],
      paint: {
        'line-color': c.boundary,
        'line-dasharray': [1, 1.5],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 11, 1.5],
      },
    },
    // ---- labels ----
    {
      id: 'water_name_line_label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 350,
        'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
        'text-font': fontItalic,
        'text-letter-spacing': 0.2,
        'text-max-width': 5,
        'text-size': 14,
      },
      paint: { 'text-color': c.waterLabel, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.5 },
    },
    {
      id: 'water_name_point_label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      filter: ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false],
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
        'text-font': fontItalic,
        'text-letter-spacing': 0.2,
        'text-max-width': 5,
        'text-size': 13,
      },
      paint: { 'text-color': c.waterLabel, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.5 },
    },
    {
      id: 'highway_name_minor',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 15,
      filter: [
        'all',
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
      ],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
        'text-font': fontRegular,
        'text-rotation-alignment': 'map',
        'text-size': 12,
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1 },
    },
    {
      id: 'highway_name_major',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 12.2,
      filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk'], true, false],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
        'text-font': fontRegular,
        'text-rotation-alignment': 'map',
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 14, 13],
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1 },
    },
    {
      id: 'label_suburb',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 8,
      filter: ['match', ['get', 'class'], ['city', 'continent', 'country', 'state'], false, true],
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
        'text-font': fontItalic,
        'text-letter-spacing': 0.1,
        'text-max-width': 9,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 12, 11],
        'text-transform': 'uppercase',
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'label_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 3,
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
        'text-font': fontBold,
        'text-max-width': 8,
        'text-size': ['interpolate', ['exponential', 1.2], ['zoom'], 4, 11, 7, 13, 11, 17],
      },
      paint: { 'text-color': ground.text, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
    },
  ],
};
