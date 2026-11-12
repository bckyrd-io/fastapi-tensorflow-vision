/** Port of app/usage/page.tsx (Next.js → Expo) */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable, type TableColumn } from '@/components/ui/table';
import { LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { Haptics } from '@/lib/haptics';
import { useAuthStore } from '@/stores/authStore';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

const ROLE_BADGE_VARIANT: Record<User['role'], BadgeVariant> = {
  admin: 'default',
  operator: 'info',
  viewer: 'secondary',
};

function StatCard({ label, value, valueColor }: { label: string; value: number; valueColor: string }) {
  const t = useTheme();
  return (
    <Card style={{ width: '48%', flexGrow: 1 }}>
      <CardHeader>
        <Text
          style={{
            color: t.colors.cardForeground,
            fontSize: t.fontSize.sm,
            fontWeight: t.fontWeight.medium,
          }}
        >
          {label}
        </Text>
      </CardHeader>
      <CardContent>
        <Text
          style={{
            color: valueColor,
            fontSize: t.fontSize.xxl,
            fontWeight: t.fontWeight.bold,
          }}
        >
          {value}
        </Text>
      </CardContent>
    </Card>
  );
}

export default function UsageScreen() {
  const t = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
  });

  const isAdmin = user?.role === 'admin';

  // Fetch users
  const fetchUsers = async () => {
    try {
      const data = await apiFetch<{ users?: User[] }>('/api/users');

      if (data.users) {
        setUsers(data.users);

        // Calculate stats
        const total = data.users.length;
        const active = data.users.filter((u) => u.is_active).length;
        const inactive = data.users.filter((u) => !u.is_active).length;
        const admins = data.users.filter((u) => u.role === 'admin').length;

        setStats({ total, active, inactive, admins });
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Redirect non-admin users
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    void (async () => {
      await fetchUsers();
    })();
  }, [isAdmin]);

  // Filter users based on search query (derived during render — no effect)
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
    );
  }, [searchQuery, users]);

  // Toggle user active status
  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    Haptics.medium();
    try {
      await apiFetch('/api/users', {
        method: 'PUT',
        body: { id: userId, isActive: !currentStatus },
      });

      // Refresh users
      fetchUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  // Delete user (with confirmation — Code with Beto: Alert.alert for destructive confirms)
  const deleteUser = (userId: number) => {
    if (user?.id === userId) {
      toast.error('You cannot delete your own account');
      return;
    }

    Alert.alert('Delete User', 'Are you sure you want to delete this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void performDelete(userId);
        },
      },
    ]);
  };

  const performDelete = async (userId: number) => {
    try {
      await apiFetch(`/api/users?id=${userId}`, { method: 'DELETE' });

      toast.success('User deleted successfully');
      // Refresh users
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    }
  };

  if (!isAdmin) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState message="Loading users..." />
      </Screen>
    );
  }

  const columns: TableColumn<User>[] = [
    {
      key: 'user',
      label: 'User',
      flex: 1.4,
      minWidth: 160,
      render: (u) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Ionicons
            name={u.role === 'admin' ? 'shield' : 'person'}
            size={16}
            color={t.colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.colors.foreground,
                fontSize: t.fontSize.sm,
                fontWeight: t.fontWeight.medium,
              }}
            >
              {u.full_name || u.username}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}
            >
              {u.email}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      flex: 0.9,
      render: (u) => <Badge variant={ROLE_BADGE_VARIANT[u.role]}>{u.role}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      flex: 1,
      render: (u) => (
        <Badge variant={u.is_active ? 'success' : 'destructive'}>
          {u.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'last_login',
      label: 'Last Login',
      flex: 1,
      render: (u) =>
        u.last_login ? (
          <Text
            numberOfLines={2}
            style={{ color: t.colors.foreground, fontSize: t.fontSize.xs }}
          >
            {new Date(u.last_login).toLocaleDateString()}
          </Text>
        ) : (
          <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}>Never</Text>
        ),
    },
    {
      key: 'created_at',
      label: 'Created',
      flex: 1,
      render: (u) => (
        <Text numberOfLines={2} style={{ color: t.colors.foreground, fontSize: t.fontSize.xs }}>
          {new Date(u.created_at).toLocaleDateString()}
        </Text>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      flex: 3,
      minWidth: 250,
      align: 'right',
      render: (u) => (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: t.spacing.xs,
          }}
        >
          <Button
            variant="outline"
            size="sm"
            icon="create-outline"
            onPress={() => router.push(`/usage/edit-user/${u.id}`)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon="power"
            onPress={() => toggleUserStatus(u.id, u.is_active)}
          >
            {u.is_active ? 'Disable' : 'Enable'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            icon="trash-outline"
            onPress={() => deleteUser(u.id)}
          >
            Delete
          </Button>
        </View>
      ),
    },
  ];

  return (
    <ScreenScroll>
      {/* Subtitle (page title lives in the drawer header) */}
      <View style={{ gap: t.spacing.xs }}>
        <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>
          Manage all users and their permissions
        </Text>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.lg }}>
        <StatCard label="Total Users" value={stats.total} valueColor={t.colors.foreground} />
        <StatCard label="Active" value={stats.active} valueColor={t.colors.success} />
        <StatCard label="Inactive" value={stats.inactive} valueColor={t.colors.mutedForeground} />
        <StatCard label="Admins" value={stats.admins} valueColor={t.colors.chart1} />
      </View>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <Input
            icon="search"
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </CardHeader>
        <CardContent>
          <DataTable<User>
            columns={columns}
            data={filteredUsers}
            keyExtractor={(u) => String(u.id)}
            emptyTitle="No users found"
            emptyDescription="Users matching your search will appear here."
          />
        </CardContent>
      </Card>
    </ScreenScroll>
  );
}
