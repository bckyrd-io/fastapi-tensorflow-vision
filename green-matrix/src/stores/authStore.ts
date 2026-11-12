/**
 * Auth store (ported from the Next.js zustand store).
 * localStorage -> AsyncStorage, raw fetch -> lib/api, plus an explicit
 * `hydrated` flag so the root layout can hold the splash screen until the
 * persisted session has been read (Expo Router auth pattern).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { apiFetch } from '@/lib/api';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'operator' | 'viewer';
  lastLogin?: string;
}

const USER_KEY = 'auth_user';
const TOKEN_KEY = 'auth_token';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True once the persisted session has been read from storage. */
  hydrated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
  /** Read persisted session; call once from the root layout. */
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<{ success: boolean; token?: string; user: User }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: { username, password },
        }
      );

      if (data?.success) {
        const user: User = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          fullName: data.user.fullName,
          role: data.user.role,
          lastLogin: new Date().toISOString(),
        };

        set({ user, isAuthenticated: true, isLoading: false });

        await AsyncStorage.multiSet([
          [USER_KEY, JSON.stringify(user)],
          [TOKEN_KEY, data.token ?? ''],
        ]);

        return true;
      }

      set({ isLoading: false });
      return false;
    } catch (error) {
      console.error('Login error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
    AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
    // Best-effort server-side logout (same as the old app).
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  },

  setUser: (user: User) => {
    set({ user, isAuthenticated: true });
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_KEY);
      if (stored) {
        const user: User = JSON.parse(stored);
        set({ user, isAuthenticated: true, hydrated: true });
        return;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      await AsyncStorage.removeItem(USER_KEY);
    }
    set({ hydrated: true });
  },
}));
