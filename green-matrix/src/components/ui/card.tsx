/**
 * Card — surface container matching the shadcn Card from the old app.
 */
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.colors.card,
          borderColor: t.colors.border,
          borderRadius: t.radius.lg,
        },
        t.shadows.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ gap: t.spacing.xs, padding: t.spacing.lg, paddingBottom: 0 }, style]}>{children}</View>
  );
}

export function CardTitle({ children, style }: { children: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          color: t.colors.cardForeground,
          fontSize: t.fontSize.lg,
          fontWeight: t.fontWeight.semibold,
          letterSpacing: -0.3,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function CardDescription({ children, style }: { children: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <Text style={[{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }, style]}>{children}</Text>
  );
}

export function CardContent({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ padding: t.spacing.lg }, style]}>{children}</View>;
}

export function CardFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          padding: t.spacing.lg,
          paddingTop: 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
