/**
 * Authenticated area — Drawer navigation replacing the old sidebar layout.
 * Route files mirror the original Next.js URLs (/dashboard, /monitoring, ...,
 * /usage/edit-user/[id]).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Pressable } from 'react-native';

import { AppDrawerContent } from '@/components/drawer-content';
import { useTheme } from '@/hooks/use-theme';

/**
 * Landing route after login / auth-guard redirects. `launcher` redirects to
 * the role-appropriate screen once this navigator is mounted.
 */
export const unstable_settings = { anchor: 'launcher' };

export default function AppLayout() {
  const t = useTheme();

  return (
    <Drawer
      backBehavior="initialRoute"
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.background },
        headerTintColor: t.colors.foreground,
        headerTitleStyle: { color: t.colors.foreground, fontWeight: t.fontWeight.semibold },
        headerShadowVisible: true,
        drawerType: 'front',
        drawerStyle: { backgroundColor: t.colors.sidebar, width: 290 },
        drawerActiveTintColor: t.colors.sidebarAccentForeground,
        drawerInactiveTintColor: t.colors.mutedForeground,
        sceneStyle: { backgroundColor: t.colors.background },
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen
        name="launcher"
        options={{ drawerItemStyle: { display: 'none' }, headerShown: false }}
      />
      <Drawer.Screen name="dashboard" options={{ title: 'Dashboard', headerTitle: 'Dashboard' }} />
      <Drawer.Screen name="vision" options={{ title: 'Camera & Vision' }} />
      <Drawer.Screen name="monitoring" options={{ title: 'Sensor Monitoring' }} />
      <Drawer.Screen name="triggers" options={{ title: 'Triggers' }} />
      <Drawer.Screen name="zones" options={{ title: 'Farm Zones' }} />
      <Drawer.Screen
        name="zone-config"
        options={{
          title: 'Zone Configuration',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/zones' as never)}
              style={{ paddingLeft: 12, paddingRight: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={t.colors.foreground} />
            </Pressable>
          ),
        }}
      />
      {/* Reports is a sub-screen of the dashboard, not a drawer destination. */}
      <Drawer.Screen
        name="reports"
        options={{
          title: 'Reports',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Dashboard"
              onPress={() => router.replace('/dashboard' as never)}
              style={{ paddingLeft: 12, paddingRight: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={t.colors.foreground} />
            </Pressable>
          ),
        }}
      />
      <Drawer.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Drawer.Screen
        name="usage/index"
        options={{ title: 'User Management', drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="usage/profile"
        options={{ title: 'Profile', drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="usage/edit-user/[id]"
        options={{ title: 'Edit User', drawerItemStyle: { display: 'none' } }}
      />
    </Drawer>
  );
}
