/**
 * Registration screen (route "/register" — port of app/register/page.tsx +
 * components/register-form.tsx).
 */
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Logo } from '@/components/logo';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { FieldGroup, Input } from '@/components/ui/input';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch } from '@/lib/api';

export default function RegisterScreen() {
  const t = useTheme();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: {
          username: formData.email.split('@')[0],
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: 'operator',
        },
      });

      toast.success('Account created successfully!');
      router.replace('/');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'An error occurred. Please try again.'
      );
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
                Create Account
              </Text>
            </View>

              <Input
                placeholder="Name"
                value={formData.fullName}
                onChangeText={(fullName) => setFormData({ ...formData, fullName })}
                autoCapitalize="words"
                textContentType="name"
                style={{ minHeight: 48 }}
              />
           
              <Input
                placeholder="email@example.com"
                value={formData.email}
                onChangeText={(email) => setFormData({ ...formData, email })}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={{ minHeight: 48 }}
              />
           
              <Input
                placeholder="********"
                value={formData.password}
                onChangeText={(password) => setFormData({ ...formData, password })}
                secureTextEntry
                textContentType="newPassword"
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
            Already have an account?{' '}
            <Link href="/" style={{ color: t.colors.primary, fontWeight: t.fontWeight.medium }}>
              Sign in
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
