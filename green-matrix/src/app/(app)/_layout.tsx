/**
 * Authenticated area — Drawer navigation replacing the old sidebar layout.
 * Route files mirror the original Next.js URLs (/dashboard, /monitoring, ...,
 * /usage/edit-user/[id]).
 */
import { Drawer } from 'expo-router/drawer';

import { AppDrawerContent } from '@/components/drawer-content';
import { useTheme } from '@/hooks/use-theme';

/** Landing route after login / auth-guard redirects (docs: `unstable_settings.anchor`). */
export const unstable_settings = { anchor: 'dashboard' };

export default function AppLayout() {
  const t = useTheme();

  return (
    <Drawer
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
      <Drawer.Screen name="dashboard" options={{ title: 'Dashboard', headerTitle: 'Dashboard' }} />
      <Drawer.Screen name="monitoring" options={{ title: 'Sensor Monitoring' }} />
      <Drawer.Screen name="feeding" options={{ title: 'Feeding Control' }} />
      <Drawer.Screen name="ponds" options={{ title: 'Zones' }} />
      <Drawer.Screen name="pond-config" options={{ title: 'Zone Configuration' }} />
      <Drawer.Screen name="reports" options={{ title: 'Reports' }} />
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
