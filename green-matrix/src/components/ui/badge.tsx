/**
 * Badge — status pill matching the shadcn Badge (critical/warning/info,
 * active/inactive, roles...).
 */
import { StyleSheet, Text, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'warning'
  | 'success'
  | 'info';

export function Badge({
  children,
  variant = 'default',
  style,
}: {
  children: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}) {
  const t = useTheme();

  let backgroundColor = t.colors.primary;
  let color = t.colors.primaryForeground;
  let borderColor = 'transparent';

  switch (variant) {
    case 'secondary':
      backgroundColor = t.colors.secondary;
      color = t.colors.secondaryForeground;
      break;
    case 'outline':
      backgroundColor = 'transparent';
      color = t.colors.foreground;
      borderColor = t.colors.border;
      break;
    case 'destructive':
      backgroundColor = t.colors.destructive;
      color = t.colors.destructiveForeground;
      break;
    case 'warning':
      backgroundColor = t.colors.warning;
      color = t.colors.warningForeground;
      break;
    case 'success':
      backgroundColor = t.colors.success;
      color = t.colors.successForeground;
      break;
    case 'info':
      backgroundColor = t.colors.chart1;
      color = '#ffffff';
      break;
  }

  return (
    <Text
      style={[
        styles.badge,
        { backgroundColor, color, borderColor, borderRadius: t.radius.full },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
});
