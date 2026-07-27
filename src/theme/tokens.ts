/**
 * Design tokens — imported from assets/tokens/tokens.json ("Organic" design system).
 * Fonts: Caprasimo (headings), Figtree (body).
 */
export const ground = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  surfaceLight: '#faf3e7',
  text: '#201e1d',
  textMuted: '#8a8177',
  accent: '#c67139',
  accent2: '#7a8a5e',
  accentTint: '#fde4d4',
  dark: '#3a352f',
  white: '#fffdf9',
} as const;

export type CategoryId = 'historical' | 'forest' | 'water';

export interface CategoryPalette {
  ink: string;
  tint: string;
  deep: string;
}

export const categories: Record<CategoryId, CategoryPalette> = {
  historical: { ink: '#b04437', tint: '#f6e0d8', deep: '#7c3323' },
  forest: { ink: '#6f8153', tint: '#e1eecc', deep: '#56633f' },
  water: { ink: '#4f7d99', tint: '#dfebf1', deep: '#35586e' },
};

export const radii = { sm: 8, md: 16, lg: 28, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

/** Motion notes from tokens.json — respect reduce-motion. */
export const motion = {
  stampSlam: { duration: 600, fromScale: 2.8, rotate: '-8deg' },
  unlock: { duration: 800 },
} as const;
