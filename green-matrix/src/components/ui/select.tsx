/**
 * Select — dropdown backed by a native Modal (Code with Beto prefers native
 * sheets over a hand-rolled popover; Modal also works in Expo Go on every
 * platform including web). API mirrors shadcn Select: value + onValueChange.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Haptics } from '@/lib/haptics';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  style?: ViewStyle;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  invalid = false,
  style,
}: SelectProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Haptics.light();
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: invalid ? t.colors.destructive : t.colors.input,
            backgroundColor: t.colors.background,
            borderRadius: t.radius.md,
          },
          pressed && { opacity: 0.8 },
          disabled && { opacity: 0.5 },
          style,
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: selected ? t.colors.foreground : t.colors.mutedForeground,
            fontSize: t.fontSize.base,
          }}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={t.colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: t.colors.popover,
                borderRadius: t.radius.lg,
                borderColor: t.colors.border,
              },
              t.shadows.lg,
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: t.spacing.lg,
                paddingBottom: t.spacing.sm,
              }}
            >
              <Text
                style={{
                  color: t.colors.popoverForeground,
                  fontSize: t.fontSize.base,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                {placeholder}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button">
                <Ionicons name="close" size={20} color={t.colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={{ paddingBottom: t.spacing.sm, maxHeight: 320 }}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="menuitem"
                    onPress={() => {
                      Haptics.selection();
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: t.spacing.sm,
                        paddingHorizontal: t.spacing.lg,
                        paddingVertical: t.spacing.md,
                        backgroundColor: pressed ? t.colors.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        flex: 1,
                        color: active ? t.colors.primary : t.colors.popoverForeground,
                        fontSize: t.fontSize.base,
                        fontWeight: active ? t.fontWeight.medium : t.fontWeight.regular,
                      }}
                    >
                      {option.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={t.colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = {
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderWidth: 1,
    overflow: 'hidden',
  },
} satisfies Record<string, ViewStyle>;
