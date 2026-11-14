/**
 * Tabs — segmented control matching shadcn Tabs (used on zone-config and
 * alerts). Controlled by the screen, animated with native press states.
 */
import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Haptics } from '@/lib/haptics';

export interface TabItem {
  value: string;
  label: string;
}

export function Tabs({
  items,
  value,
  onValueChange,
  style,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  style?: ViewStyle;
}) {
  const t = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        {
          gap: t.spacing.xs,
          backgroundColor: t.colors.muted,
          borderRadius: t.radius.md,
          padding: t.spacing.xs,
        },
        style,
      ]}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) {
                Haptics.selection();
                onValueChange(item.value);
              }
            }}
            style={({ pressed }) => [
              {
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm - 1,
                borderRadius: t.radius.sm,
                backgroundColor: active ? t.colors.background : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: t.colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={{
                color: active ? t.colors.foreground : t.colors.mutedForeground,
                fontSize: t.fontSize.sm,
                fontWeight: active ? t.fontWeight.medium : t.fontWeight.regular,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TabsContent({
  active,
  value,
  children,
}: {
  active: string;
  value: string;
  children: React.ReactNode;
}) {
  if (active !== value) return null;
  return <View style={{ gap: 0 }}>{children}</View>;
}
