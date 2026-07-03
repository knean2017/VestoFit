import { palette, spacing, radii, typography, shadows } from './tokens';

export const lightTheme = {
  colors: {
    background: palette.cream,
    surface: palette.white,
    card: palette.white,
    cardBorder: palette.line,
    accent: palette.coral,
    accentLight: palette.coralLight,
    accentDark: palette.coralDark,
    ink: palette.ink,
    muted: palette.muted,
    line: palette.line,
    sand: palette.sand,
    stone: palette.stone,
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
    info: palette.info,
    white: palette.white,
    tabBar: palette.white,
    tabBarBorder: palette.line,
    tabActive: palette.coral,
    tabInactive: palette.muted,
  },
  spacing,
  radii,
  typography,
  shadows,
} as const;

export const darkTheme = {
  colors: {
    background: palette.darkBg,
    surface: palette.darkSurface,
    card: palette.darkCard,
    cardBorder: palette.darkLine,
    accent: palette.coral,
    accentLight: palette.coralLight,
    accentDark: palette.coralDark,
    ink: palette.darkInk,
    muted: palette.darkMuted,
    line: palette.darkLine,
    sand: palette.darkSurface,
    stone: palette.darkCard,
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
    info: palette.info,
    white: palette.white,
    tabBar: palette.darkSurface,
    tabBarBorder: palette.darkLine,
    tabActive: palette.coral,
    tabInactive: palette.darkMuted,
  },
  spacing,
  radii,
  typography,
  shadows,
} as const;

export type AppTheme = typeof lightTheme;
export type DarkTheme = typeof darkTheme;

type ThemeShape = {
  colors: Record<string, string>;
  spacing: typeof import('./tokens').spacing;
  radii: typeof import('./tokens').radii;
  typography: typeof import('./tokens').typography;
  shadows: typeof import('./tokens').shadows;
};

declare module 'react-native-unistyles' {
  interface UnistylesThemes {
    light: ThemeShape;
    dark: ThemeShape;
  }
}
