/** Port of app/usage/edit-user/[id]/page.tsx (Next.js → Expo) */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/separator';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch } from '@/lib/api';
import { Haptics } from '@/lib/haptics';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
}

export default function EditUserScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = id;

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'operator',
    isActive: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiFetch<{ user: User }>(`/api/users?id=${userId}`);
        const user: User = data.user;
        setFormData({
          username: user.username,
          email: user.email,
          password: '',
          fullName: user.full_name || '',
          role: user.role,
          isActive: user.is_active,
        });
      } catch (err) {
        setError(err instanceof ApiError ? 'Failed to load user data' : 'Network error occurred');
      } finally {
        setFetchLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const updateData: {
        username: string;
        email: string;
        fullName: string;
        role: string;
        isActive: boolean;
        password?: string;
      } = {
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
        isActive: formData.isActive,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      await apiFetch(`/api/users/${userId}`, {
        method: 'PUT',
        body: updateData,
      });

      Haptics.success();
      router.push('/usage');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }) as typeof formData);
  };

  if (fetchLoading) {
    return (
      <Screen>
        <LoadingState message="Loading user data..." />
      </Screen>
    );
  }

  return (
    <ScreenScroll>
      <Card>
        <CardContent style={{ gap: t.spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
            <Field label="Username" required style={{ flex: 1 }}>
              <Input
                value={formData.username}
                onChangeText={(value) => handleInputChange('username', value)}
                autoCapitalize="none"
              />
            </Field>
            <Field label="Email" required style={{ flex: 1 }}>
              <Input
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
              />
            </Field>
          </View>

          <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
            <Field label="Password" style={{ flex: 1 }}>
              <Input
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry
                placeholder="Leave blank to keep current password"
              />
            </Field>
            <Field label="Full Name" style={{ flex: 1 }}>
              <Input
                value={formData.fullName}
                onChangeText={(value) => handleInputChange('fullName', value)}
                autoCapitalize="words"
              />
            </Field>
          </View>

          <Field label="Role" required>
            <Select
              value={formData.role}
              onValueChange={(value) => handleInputChange('role', value || '')}
              options={[
                { label: 'Operator', value: 'operator' },
                { label: 'Admin', value: 'admin' },
              ]}
              placeholder="Select a role"
            />
          </Field>

          <Checkbox
            checked={formData.isActive}
            onCheckedChange={(checked) => handleInputChange('isActive', checked)}
            label="Active user account"
          />

          {error ? <ErrorBanner message={error} /> : null}

          <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
            <Button icon="create-outline" loading={loading} onPress={handleSubmit}>
              {loading ? 'Updating...' : 'Update User'}
            </Button>
            <Button variant="outline" onPress={() => router.push('/usage')}>
              Cancel
            </Button>
          </View>
        </CardContent>
      </Card>
    </ScreenScroll>
  );
}
