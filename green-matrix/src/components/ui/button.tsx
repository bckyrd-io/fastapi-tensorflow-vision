/**
 * Button — Pressable + haptics (Code with Beto: never TouchableOpacity).
 * Variants mirror the shadcn buttons used by the old Next.js app.
 */
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Haptics } from '@/lib/haptics';

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'success'
  | 'warning';

export type ButtonSize = 'sm' | 'default' | 'lg';

export interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and disables presses. */
  loading?: boolean;
  /** Ionicons name rendered before the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  icon,
  fullWidth,
  style,
}: ButtonProps) {
  const t = useTheme();
  const inactive = disabled || loading;

  const containerStyles: ViewStyle[] = [
    styles.base,
    {
      borderRadius: t.radius.md,
      paddingVertical: size === 'sm' ? t.spacing.xs + 2 : size === 'lg' ? t.spacing.md + 2 : t.spacing.sm + 3,
      paddingHorizontal: size === 'sm' ? t.spacing.md : t.spacing.lg,
      gap: t.spacing.sm,
    },
  ];

  switch (variant) {
    case 'secondary':
      containerStyles.push({ backgroundColor: t.colors.secondary });
      break;
    case 'outline':
      containerStyles.push({
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: t.colors.border,
      });
      break;
    case 'ghost':
      containerStyles.push({ backgroundColor: 'transparent' });
      break;
    case 'destructive':
      containerStyles.push({ backgroundColor: t.colors.destructive });
      break;
    case 'success':
      containerStyles.push({ backgroundColor: t.colors.success });
      break;
    case 'warning':
      containerStyles.push({ backgroundColor: t.colors.warning });
      break;
    default:
      containerStyles.push({ backgroundColor: t.colors.primary });
  }

  const labelColor =
    variant === 'default' || variant === 'destructive' || variant === 'success'
      ? t.colors.primaryForeground
      : variant === 'warning'
        ? t.colors.warningForeground
        : variant === 'outline' || variant === 'ghost'
          ? t.colors.foreground
          : t.colors.secondaryForeground;

  const iconSize = size === 'sm' ? 15 : 17;
  const iconColor =
    variant === 'default' || variant === 'destructive' || variant === 'success'
      ? t.colors.primaryForeground
      : variant === 'warning'
        ? t.colors.warningForeground
        : t.colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        Haptics.light();
        onPress?.();
      }}
      style={({ pressed }) => [
        containerStyles,
        fullWidth && styles.fullWidth,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        icon && <Ionicons name={icon} size={iconSize} color={iconColor} />
      )}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: labelColor,
            fontSize: size === 'sm' ? t.fontSize.sm : t.fontSize.base,
            fontWeight: t.fontWeight.medium,
          },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    textAlign: 'center',
  },
});
