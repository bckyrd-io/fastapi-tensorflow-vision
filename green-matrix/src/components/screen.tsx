/**
 * Screen containers.
 *
 * - <Screen>         fixed (non-scrolling) page shell — pair with a FlatList
 *                    for API-driven lists (Beto rule).
 * - <ScreenScroll>   scrolling shell for forms / card-heavy pages, using
 *                    contentInsetAdjustmentBehavior instead of blanket
 *                    SafeAreaView (Beto rule) + keyboard handling.
 */
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

export function Screen({
  children,
  style,
  noPadding,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Disable the default 16px page padding (e.g. full-bleed lists). */
  noPadding?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[{ flex: 1, backgroundColor: t.colors.background }, style]}>
      <View
        style={{
          flex: 1,
          paddingTop: t.spacing.lg,
          paddingHorizontal: noPadding ? 0 : t.spacing.lg,
          paddingBottom: noPadding ? 0 : insets.bottom,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function ScreenScroll({
  children,
  style,
  contentStyle,
  noPadding,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  noPadding?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[{ flex: 1, backgroundColor: t.colors.background }, style]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1 }}
        contentContainerStyle={[
          {
            paddingTop: t.spacing.lg,
            paddingHorizontal: noPadding ? 0 : t.spacing.lg,
            paddingBottom: insets.bottom + t.spacing.xl,
            gap: t.spacing.lg,
          },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}
