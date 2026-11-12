/** Port of app/usage/profile/page.tsx (Next.js → Expo) */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
}

export default function ProfileScreen() {
  const t = useTheme();
  const { user } = useAuthStore();

  const [fetchLoading, setFetchLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      router.push('/dashboard');
      return;
    }

    const fetchUser = async () => {
      try {
        const data = await apiFetch<{ user: User }>(`/api/users?id=${user.id}`);
        setProfileData(data.user);
      } catch (err) {
        setError(err instanceof ApiError ? 'Failed to load profile data' : 'Network error occurred');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchUser();
  }, [user]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  if (fetchLoading) {
    return (
      <Screen>
        <LoadingState message="Loading profile data..." />
      </Screen>
    );
  }

  if (!profileData) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorBanner message={error || 'No profile data available'} />
        </View>
      </Screen>
    );
  }

  return (
    <ScreenScroll>
      {/* Subtitle (page title lives in the drawer header) */}
      <View style={{ gap: t.spacing.xs }}>
        <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>
          View your profile information
        </Text>
      </View>

      <Card>
        <CardContent style={{ gap: t.spacing.xl }}>
          {/* Avatar Section */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: t.radius.full,
                backgroundColor: t.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: t.colors.primaryForeground,
                  fontSize: t.fontSize.xl,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                {getInitials(profileData.full_name || profileData.username)}
              </Text>
            </View>
            <View style={{ gap: t.spacing.xs }}>
              <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>
                User Profile
              </Text>
              <Text
                style={{
                  color: t.colors.foreground,
                  fontSize: t.fontSize.lg,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                {profileData.full_name || profileData.username}
              </Text>
            </View>
          </View>

          <Separator />

          {/* Profile Details */}
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <Text
                  style={{
                    color: t.colors.mutedForeground,
                    fontSize: t.fontSize.sm,
                    fontWeight: t.fontWeight.medium,
                  }}
                >
                  Full Name
                </Text>
                <Text
                  style={{
                    color: t.colors.foreground,
                    fontSize: t.fontSize.base,
                    fontWeight: t.fontWeight.semibold,
                  }}
                >
                  {profileData.full_name || 'Not set'}
                </Text>
              </View>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <Text
                  style={{
                    color: t.colors.mutedForeground,
                    fontSize: t.fontSize.sm,
                    fontWeight: t.fontWeight.medium,
                  }}
                >
                  Username
                </Text>
                <Text
                  style={{
                    color: t.colors.foreground,
                    fontSize: t.fontSize.base,
                    fontWeight: t.fontWeight.semibold,
                  }}
                >
                  {profileData.username}
                </Text>
              </View>
            </View>

            <View style={{ gap: t.spacing.xs }}>
              <Text
                style={{
                  color: t.colors.mutedForeground,
                  fontSize: t.fontSize.sm,
                  fontWeight: t.fontWeight.medium,
                }}
              >
                Email
              </Text>
              <Text
                style={{
                  color: t.colors.foreground,
                  fontSize: t.fontSize.base,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                {profileData.email}
              </Text>
            </View>
          </View>

          <Separator />

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button
              variant="outline"
              icon="create-outline"
              onPress={() => router.push(`/usage/edit-user/${user?.id}`)}
            >
              Edit Profile
            </Button>
          </View>
        </CardContent>
      </Card>
    </ScreenScroll>
  );
}
