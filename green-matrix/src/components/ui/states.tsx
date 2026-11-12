/**
 * Intentional loading + empty states (Code with Beto: never a bare spinner
 * or a blank screen — tell the user what is happening).
 */
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function LoadingState({
  message = 'Loading…',
  style,
}: {
  message?: string;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.spacing.md,
          padding: t.spacing.xxl,
          minHeight: 160,
        },
        style,
      ]}
    >
      <ActivityIndicator size="large" color={t.colors.primary} />
      <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  icon = 'file-tray-outline',
  action,
  compact,
  style,
}: {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: React.ReactNode;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.spacing.xs,
          paddingVertical: compact ? t.spacing.xl : t.spacing.xxxl,
          paddingHorizontal: t.spacing.xl,
        },
        style,
      ]}
    >
      <View
        style={{
          width: compact ? 36 : 56,
          height: compact ? 36 : 56,
          borderRadius: t.radius.full,
          backgroundColor: t.colors.muted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.xs,
        }}
      >
        <Ionicons
          name={icon}
          size={compact ? 18 : 26}
          color={t.colors.mutedForeground}
        />
      </View>
      <Text
        style={{
          color: t.colors.foreground,
          fontSize: compact ? t.fontSize.sm : t.fontSize.base,
          fontWeight: t.fontWeight.semibold,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            color: t.colors.mutedForeground,
            fontSize: t.fontSize.sm,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: t.spacing.md }}>{action}</View> : null}
    </View>
  );
}

/** Inline error banner used by forms and screens that fail to load. */
export function ErrorBanner({ message }: { message: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        backgroundColor: t.colors.destructive,
        borderRadius: t.radius.md,
        padding: t.spacing.md,
      }}
    >
      <Ionicons name="alert-circle" size={16} color={t.colors.destructiveForeground} />
      <Text style={{ flex: 1, color: t.colors.destructiveForeground, fontSize: t.fontSize.sm }}>
        {message}
      </Text>
    </View>
  );
}
