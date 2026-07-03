/**
 * VestoFit design tokens — derived from frontend/src/app/globals.css
 * and frontend/tailwind.config.ts brand colours.
 */

export const palette = {
  // Brand
  coral: '#ff6b5e',
  coralLight: '#ff8c82',
  coralDark: '#e5564a',

  // Neutrals (warm off-white base)
  cream: '#fbf7f0',
  sand: '#f4ede0',
  stone: '#e8ddd0',
  line: '#ddd5c8',
  muted: '#9e958a',
  ink: '#2a2522',

  // Semantic
  success: '#4caf7d',
  warning: '#f5a623',
  error: '#e53e3e',
  info: '#3b82f6',

  // Pure
  white: '#ffffff',
  black: '#000000',

  // Dark mode neutrals
  darkBg: '#1a1714',
  darkSurface: '#242018',
  darkCard: '#2e2820',
  darkLine: '#3d3630',
  darkMuted: '#7a7068',
  darkInk: '#f0ece6',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
} as const;

export const typography = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 38,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  families: {
    sans: 'Nunito',
    mono: 'SpaceMono',
  },
} as const;

export const shadows = {
  soft: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lifted: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  card: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
