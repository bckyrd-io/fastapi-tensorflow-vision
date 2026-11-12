/**
 * Design tokens for GreenMatrix (AquaMonitor farm automation).
 * Colors are ported 1:1 from the original Next.js app's globals.css
 * (shadcn/ui oklch tokens converted to hex) so the Expo app matches the old UI.
 *
 * Usage:
 *   const t = useTheme();          // resolves light/dark automatically
 *   <View style={{ backgroundColor: t.colors.background }} />
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  warning: string;
  warningForeground: string;
  success: string;
  successForeground: string;
  danger: string;
  dangerForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#ffffff',
    foreground: '#0a0a0a',
    card: '#ffffff',
    cardForeground: '#0a0a0a',
    popover: '#ffffff',
    popoverForeground: '#0a0a0a',
    primary: '#3ddc84',
    primaryForeground: '#0a0a0a',
    secondary: '#f5f5f5',
    secondaryForeground: '#171717',
    muted: '#f5f5f5',
    mutedForeground: '#737373',
    accent: '#f5f5f5',
    accentForeground: '#171717',
    destructive: '#e7000b',
    destructiveForeground: '#ffffff',
    warning: '#d9a514',
    warningForeground: '#0a0a0a',
    success: '#4aa651',
    successForeground: '#ffffff',
    danger: '#d40924',
    dangerForeground: '#ffffff',
    border: '#e5e5e5',
    input: '#e5e5e5',
    ring: '#3ddc84',
    chart1: '#00a6c1',
    chart2: '#d9a514',
    chart3: '#e7000b',
    chart4: '#4aa651',
    chart5: '#737373',
    sidebar: '#fafafa',
    sidebarForeground: '#0a0a0a',
    sidebarBorder: '#e5e5e5',
    sidebarAccent: '#f5f5f5',
    sidebarAccentForeground: '#171717',
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#fafafa',
    card: '#171717',
    cardForeground: '#fafafa',
    popover: '#171717',
    popoverForeground: '#fafafa',
    primary: '#3ddc84',
    primaryForeground: '#0a0a0a',
    secondary: '#262626',
    secondaryForeground: '#fafafa',
    muted: '#262626',
    mutedForeground: '#a1a1a1',
    accent: '#262626',
    accentForeground: '#fafafa',
    destructive: '#ff6467',
    destructiveForeground: '#0a0a0a',
    warning: '#d9a514',
    warningForeground: '#0a0a0a',
    success: '#4aa651',
    successForeground: '#ffffff',
    danger: '#d40924',
    dangerForeground: '#ffffff',
    border: 'rgba(255,255,255,0.10)',
    input: 'rgba(255,255,255,0.15)',
    ring: '#3ddc84',
    chart1: '#00a6c1',
    chart2: '#d9a514',
    chart3: '#e7000b',
    chart4: '#4aa651',
    chart5: '#737373',
    sidebar: '#171717',
    sidebarForeground: '#fafafa',
    sidebarBorder: 'rgba(255,255,255,0.10)',
    sidebarAccent: '#262626',
    sidebarAccentForeground: '#fafafa',
  },
};

export type ThemeColor = keyof ThemeColors;

/** 4px-based spacing scale (replaces Tailwind's gap/padding utilities). */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Border radius scale (shadcn --radius: 0.625rem = 10px base). */
export const Radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 18,
  full: 999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Modern single-string shadows (RN 0.76+). Use instead of the legacy
 * shadowColor/shadowOffset/shadowOpacity/shadowRadius quartet.
 */
export const Shadows: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' },
  md: { boxShadow: '0 4px 12px rgba(0,0,0,0.10)' },
  lg: { boxShadow: '0 8px 24px rgba(0,0,0,0.14)' },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});
