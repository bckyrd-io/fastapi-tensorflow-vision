/**
 * Design-token hook. Returns the resolved color palette plus shared scales.
 *
 *   const t = useTheme();
 *   style={{ backgroundColor: t.colors.card, padding: t.spacing.lg }}
 */
import {
  Colors,
  FontSize,
  FontWeight,
  Radius,
  Shadows,
  Spacing,
  type ThemeColors,
} from '@/constants/theme';

export interface Theme {
  colors: ThemeColors;
  spacing: typeof Spacing;
  radius: typeof Radius;
  fontSize: typeof FontSize;
  fontWeight: typeof FontWeight;
  shadows: typeof Shadows;
  isDark: boolean;
}

export function useTheme(): Theme {
  // Pinned to the light palette — see use-color-scheme.ts.
  const isDark = false;

  return {
    colors: isDark ? Colors.dark : Colors.light,
    spacing: Spacing,
    radius: Radius,
    fontSize: FontSize,
    fontWeight: FontWeight,
    shadows: Shadows,
    isDark,
  };
}
