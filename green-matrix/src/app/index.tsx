/**
 * Login screen (route "/" — port of app/page.tsx + components/login-form.tsx).
 */
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { FieldGroup, Input } from '@/components/ui/input';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const t = useTheme();
  const toast = useToast();
  const login = useAuthStore((state) => state.login);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });

  const handleSubmit = async () => {
    if (!formData.username || !formData.password) {
      toast.error('Please enter your username and password');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(formData.username, formData.password);
      if (success) {
        // The auth gate in the root layout swaps to the `(app)` group, whose
        // `launcher` route redirects to the role-appropriate screen.
        toast.success('Login successful!');
      } else {
        toast.error('Invalid username or password');
      }
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: t.spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: t.spacing.xl }}>
          <FieldGroup>
            <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
              <Logo size={56} />
              <Text
                style={{
                  color: t.colors.foreground,
                  fontSize: t.fontSize.xl,
                  fontWeight: t.fontWeight.bold,
                  textAlign: 'center',
                }}
              >
                ZONE MATRIX
              </Text>
            </View>


            <Input
              placeholder="Name"
              value={formData.username}
              onChangeText={(username) => setFormData({ ...formData, username })}
              autoCapitalize="none"
              autoComplete="username"
              textContentType="username"
              style={{ minHeight: 48 }}
            />

            <Input
              placeholder="Password"
              value={formData.password}
              onChangeText={(password) => setFormData({ ...formData, password })}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              style={{ minHeight: 48 }}
              onSubmitEditing={handleSubmit}
            />

            <View>
              <Button fullWidth loading={isLoading} onPress={handleSubmit} style={{ minHeight: 48 }}>
                {isLoading ? 'Processing...' : 'Submit'}
              </Button>
            </View>
          </FieldGroup>

          <Text
            style={{
              color: t.colors.mutedForeground,
              fontSize: t.fontSize.sm,
              textAlign: 'center',
            }}
          >
           No Account Yet?{' '}
            <Link href="/register" style={{ color: t.colors.primary, fontWeight: t.fontWeight.medium }}>
              Sign up
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
