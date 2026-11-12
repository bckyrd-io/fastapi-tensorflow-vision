/**
 * Toast — lightweight replacement for sonner. Mount <ToastProvider> once in
 * the root layout, then `const toast = useToast()` and call
 * toast.success('...') / toast.error('...') exactly like sonner.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { Haptics } from '@/lib/haptics';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const opacity = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(-12), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -12, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (text: string, type: ToastType) => {
      if (type === 'success') Haptics.success();
      else if (type === 'error') Haptics.error();
      else Haptics.light();

      if (timer.current) clearTimeout(timer.current);
      setToast({ id: nextId.current++, text, type });

      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
      ]).start();

      timer.current = setTimeout(hide, DURATION);
    },
    [hide, opacity, translateY]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => show(text, 'success'),
      error: (text) => show(text, 'error'),
      info: (text) => show(text, 'info'),
    }),
    [show],
  );

  const icon = toast?.type === 'success' ? 'checkmark-circle' : toast?.type === 'error' ? 'alert-circle' : 'information-circle';
  const iconColor =
    toast?.type === 'success' ? t.colors.success : toast?.type === 'error' ? t.colors.destructive : t.colors.chart1;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + (Platform.OS === 'web' ? 12 : 8),
            left: 16,
            right: 16,
            opacity,
            transform: [{ translateY }],
            zIndex: 1000,
          }}
        >
          <Pressable
            onPress={hide}
            accessibilityRole="alert"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              backgroundColor: t.colors.popover,
              borderColor: t.colors.border,
              borderWidth: 1,
              borderRadius: t.radius.lg,
              paddingVertical: t.spacing.md,
              paddingHorizontal: t.spacing.lg,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            <Ionicons name={icon} size={18} color={iconColor} />
            <Text style={{ flex: 1, color: t.colors.popoverForeground, fontSize: t.fontSize.sm }}>
              {toast.text}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
