/**
 * Separator + Checkbox — small primitives matching the old shadcn versions.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Haptics } from '@/lib/haptics';

export function Separator({
  orientation = 'horizontal',
  style,
}: {
  orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        orientation === 'horizontal'
          ? { height: 1, alignSelf: 'stretch' }
          : { width: 1, alignSelf: 'stretch' },
        { backgroundColor: t.colors.border },
        style,
      ]}
    />
  );
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTheme();

  const box = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.light();
        onCheckedChange(!checked);
      }}
      hitSlop={6}
      style={{
        width: 20,
        height: 20,
        borderRadius: t.radius.sm,
        borderWidth: 1.5,
        borderColor: checked ? t.colors.primary : t.colors.input,
        backgroundColor: checked ? t.colors.primary : t.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {checked && <Ionicons name="checkmark" size={14} color={t.colors.primaryForeground} />}
    </Pressable>
  );

  if (!label) return box;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
      {box}
      <Text style={{ flex: 1, color: t.colors.foreground, fontSize: t.fontSize.sm }}>{label}</Text>
    </View>
  );
}
