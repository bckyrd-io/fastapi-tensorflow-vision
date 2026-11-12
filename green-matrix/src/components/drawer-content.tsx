/**
 * Custom drawer content — port of components/app-sidebar.tsx + nav-main +
 * nav-user from the Next.js app (role-filtered nav, user footer with
 * profile / log out).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { Pressable, Text, View } from 'react-native';

import { Logo } from '@/components/logo';
import { useTheme } from '@/hooks/use-theme';
import { Haptics } from '@/lib/haptics';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  title: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** Same order + labels as the old sidebar (navMain array). */
const NAV_ITEMS: (NavItem & { adminOnly?: boolean })[] = [
  { title: 'Dashboard', url: '/dashboard', icon: 'bar-chart-outline' },
  { title: 'Monitoring', url: '/monitoring', icon: 'pulse-outline' },
  { title: 'Trigger', url: '/feeding', icon: 'restaurant-outline' },
  { title: 'Zones', url: '/ponds', icon: 'water-outline', adminOnly: true },
  { title: 'Configuration', url: '/pond-config', icon: 'settings-outline', adminOnly: true },
  { title: 'Reports', url: '/reports', icon: 'document-text-outline' },
  { title: 'Alerts', url: '/alerts', icon: 'notifications-outline' },
  { title: 'Usage', url: '/usage', icon: 'people-outline', adminOnly: true },
];

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const t = useTheme();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const navigate = (url: string) => {
    Haptics.light();
    props.navigation.closeDrawer();
    router.push(url as never);
  };

  const initials = (user?.fullName || user?.username || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const visibleItems = NAV_ITEMS.filter((item) => !(item.adminOnly && user?.role !== 'admin'));

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        backgroundColor: t.colors.sidebar,
        flexGrow: 1,
        paddingVertical: t.spacing.lg,
      }}
      style={{ backgroundColor: t.colors.sidebar }}
    >
      {/* Brand header (old SidebarHeader) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          paddingHorizontal: t.spacing.lg,
          paddingBottom: t.spacing.lg,
        }}
      >
        <Logo size={32} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: t.colors.sidebarForeground,
              fontSize: t.fontSize.sm,
              fontWeight: t.fontWeight.semibold,
            }}
          >
            GreenMatrix
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}
          >
            farm automation system
          </Text>
        </View>
      </View>

      {/* Nav items (old NavMain) */}
      <View style={{ gap: 2, paddingHorizontal: t.spacing.sm }}>
        {visibleItems.map((item) => {
          const active = pathname === item.url || pathname.startsWith(`${item.url}/`);
          return (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => navigate(item.url)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.sm,
                  paddingHorizontal: t.spacing.md,
                  paddingVertical: t.spacing.md - 1,
                  borderRadius: t.radius.md,
                  backgroundColor: active
                    ? t.colors.sidebarAccent
                    : pressed
                      ? t.colors.sidebarAccent
                      : 'transparent',
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={active ? t.colors.sidebarAccentForeground : t.colors.mutedForeground}
              />
              <Text
                style={{
                  flex: 1,
                  color: active
                    ? t.colors.sidebarAccentForeground
                    : t.colors.sidebarForeground,
                  fontSize: t.fontSize.sm,
                  fontWeight: active ? t.fontWeight.medium : t.fontWeight.regular,
                }}
              >
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Spacer */}
      <View style={{ flex: 1, minHeight: t.spacing.lg }} />

      {/* User footer (old NavUser: profile + log out) */}
      <View
        style={{
          marginHorizontal: t.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: t.colors.sidebarBorder,
          paddingTop: t.spacing.md,
          gap: 2,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.sm,
            paddingHorizontal: t.spacing.md,
            paddingBottom: t.spacing.sm,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: t.radius.full,
              backgroundColor: t.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: t.colors.primaryForeground, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.semibold }}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.colors.sidebarForeground,
                fontSize: t.fontSize.sm,
                fontWeight: t.fontWeight.medium,
              }}
            >
              {user?.fullName || user?.username || 'Guest'}
            </Text>
            <Text numberOfLines={1} style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}>
              {user?.email ?? ''}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigate('/usage/profile')}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              paddingHorizontal: t.spacing.md,
              paddingVertical: t.spacing.md - 2,
              borderRadius: t.radius.md,
              backgroundColor: pressed ? t.colors.sidebarAccent : 'transparent',
            },
          ]}
        >
          <Ionicons name="person-outline" size={17} color={t.colors.mutedForeground} />
          <Text style={{ color: t.colors.sidebarForeground, fontSize: t.fontSize.sm }}>Profile</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Haptics.medium();
            props.navigation.closeDrawer();
            logout();
          }}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              paddingHorizontal: t.spacing.md,
              paddingVertical: t.spacing.md - 2,
              borderRadius: t.radius.md,
              backgroundColor: pressed ? t.colors.sidebarAccent : 'transparent',
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={17} color={t.colors.destructive} />
          <Text style={{ color: t.colors.destructive, fontSize: t.fontSize.sm }}>Log out</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}
