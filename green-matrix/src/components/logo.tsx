/**
 * ZoneMatrix logo — a 2x2 matrix of four glowing green cells on a dark tile.
 * Replaces the old fish/leaf icons (a real component beats a glyph when it is
 * the brand mark).
 */
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Cell brightness pattern (irregular = "data matrix" feel). */
const PATTERN = [1, 0.35, 0.8, 0.55];

export function Logo({ size = 48, style }: { size?: number; style?: Parameters<typeof View>[0]['style'] }) {
  const t = useTheme();
  const gap = Math.max(2, Math.round(size * 0.06));
  const cell = (size - gap * 3) / 2;
  const cellRadius = Math.max(2, Math.round(cell * 0.22));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="ZoneMatrix logo"
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          backgroundColor: '#ffffff',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignContent: 'center',
          justifyContent: 'center',
          gap,
          padding: gap,
        },
        style,
      ]}
    >
      {PATTERN.map((brightness, index) => (
        <View
          key={index}
          style={{
            width: cell,
            height: cell,
            borderRadius: cellRadius,
            backgroundColor: t.colors.primary,
            opacity: brightness,
          }}
        />
      ))}
    </View>
  );
}
