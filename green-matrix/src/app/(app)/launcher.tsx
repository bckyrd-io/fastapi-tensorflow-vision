/**
 * Landing route for the authenticated area.
 *
 * The root auth gate (`Stack.Protected` in `src/app/_layout.tsx`) mounts this
 * group as soon as a session exists. Redirecting here — instead of calling
 * `router.replace()` immediately after login — means the destination is only
 * navigated to after the drawer navigator is mounted, so the action is handled.
 */
import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';

export default function AppLauncher() {
  const role = useAuthStore((state) => state.user?.role);

  return <Redirect href={role === 'admin' ? '/zones' : '/dashboard'} />;
}
