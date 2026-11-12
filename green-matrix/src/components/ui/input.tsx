/**
 * Input + Field + Label — form primitives matching the shadcn Field/Input
 * layout used by the login/register and user-management forms.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  /** Renders an inline error style. */
  invalid?: boolean;
  /** Adds the search icon (used on list screens). */
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
  invalid = false,
  icon,
  style,
  ...rest
}: InputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = invalid
    ? t.colors.destructive
    : focused
      ? t.colors.ring
      : t.colors.input;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor,
          backgroundColor: t.colors.background,
          borderRadius: t.radius.md,
          gap: t.spacing.sm,
        },
        !editable && { opacity: 0.6 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={t.colors.mutedForeground} />}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.colors.mutedForeground}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={t.colors.primary}
        style={[
          styles.input,
          { color: t.colors.foreground, fontSize: t.fontSize.base },
        ]}
        {...rest}
      />
    </View>
  );
}

export function Label({
  children,
  required,
  style,
}: {
  children: string;
  required?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          color: t.colors.foreground,
          fontSize: t.fontSize.sm,
          fontWeight: t.fontWeight.medium,
        },
        style,
      ]}
    >
      {children}
      {required ? <Text style={{ color: t.colors.destructive }}> *</Text> : null}
    </Text>
  );
}

export function FieldGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ gap: t.spacing.xl }, style]}>{children}</View>;
}

export function Field({
  label,
  required,
  children,
  description,
  error,
  style,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  description?: string;
  error?: string;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View style={[{ gap: t.spacing.sm }, style]}>
      <Label required={required}>{label}</Label>
      {children}
      {error ? (
        <Text style={{ color: t.colors.destructive, fontSize: t.fontSize.sm }}>{error}</Text>
      ) : description ? (
        <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
});
