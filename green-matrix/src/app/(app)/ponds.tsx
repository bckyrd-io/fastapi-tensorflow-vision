/** Port of app/ponds/page.tsx (Next.js → Expo) */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type TableColumn } from '@/components/ui/table';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch, apiTry } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Pond {
  id: string;
  name: string;
  location: string;
  size_sqm: number;
  depth_m: number;
  species: string;
  status: string;
  device_id?: string;
  device_name?: string;
  device_mac?: string;
  temp_min?: number;
  temp_optimal?: number;
  temp_max?: number;
  ph_min?: number;
  ph_optimal?: number;
  ph_max?: number;
  humidity_min?: number;
  humidity_optimal?: number;
  humidity_max?: number;
  water_level_min?: number;
  water_level_optimal?: number;
  water_level_max?: number;
}

interface SensorReading {
  pond_id: string;
  temperature: number;
  ph: number;
  humidity: number;
  water_level: number;
  device_id: string;
  reading_time: string;
  pond_name: string;
  is_online?: boolean;
}

interface PondWithReadings extends Pond {
  temperature?: number;
  ph?: number;
  humidity?: number;
  water_level?: number;
  last_reading_time?: string;
  is_online?: boolean;
}

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

export default function PondsScreen() {
  const t = useTheme();
  const { user } = useAuthStore();
  const [ponds, setPonds] = useState<PondWithReadings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // Redirect non-admin users
  useEffect(() => {
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin]);

  const fetchPondsData = async () => {
    try {
      setLoading(true);

      // Fetch ponds with config data
      const pondsData = await apiFetch<{ ponds: Pond[] }>('/api/ponds');

      // Fetch latest sensor readings (non-fatal if it fails)
      const readingsData = await apiTry<{ ponds: SensorReading[] }>('/api/sensors/latest');

      // Merge pond data with sensor readings
      const readingsMap = new Map<string, SensorReading>();
      readingsData?.ponds?.forEach((reading) => {
        readingsMap.set(reading.pond_id, reading);
      });

      const pondsWithReadings: PondWithReadings[] = pondsData.ponds.map((pond) => {
        const reading = readingsMap.get(pond.id);
        return {
          ...pond,
          temperature: reading?.temperature,
          ph: reading?.ph,
          humidity: reading?.humidity,
          is_online: reading?.is_online ?? false,
          water_level: reading?.water_level,
          last_reading_time: reading?.reading_time,
        };
      });

      setPonds(pondsWithReadings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchPondsData();
    })();
  }, [user]);

  const activeCount = ponds.filter((p) => p.status === 'active').length;
  const inactiveCount = ponds.filter((p) => p.status === 'inactive').length;
  const alertCount = ponds.filter((p) => {
    if (p.status !== 'active' || !p.temperature) return false;
    // Simple alert check - could be more sophisticated
    return Boolean(
      (p.temp_max && p.temperature > p.temp_max) ||
        (p.temp_min && p.temperature < p.temp_min) ||
        (p.ph_max && p.ph && p.ph > p.ph_max) ||
        (p.ph_min && p.ph && p.ph < p.ph_min)
    );
  }).length;

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
        <LoadingState message="Loading..." />
      </Screen>
    );
  }

  const columns: TableColumn<PondWithReadings>[] = [
    {
      key: 'name',
      label: 'Zone',
      flex: 1.5,
      render: (pond) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Ionicons name="water-outline" size={16} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.colors.foreground,
                fontSize: t.fontSize.sm,
                fontWeight: t.fontWeight.medium,
              }}
            >
              {pond.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}
            >
              {pond.species}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      flex: 1.1,
      render: (pond) => (
        <View>
          <Text
            numberOfLines={1}
            style={{ color: t.colors.foreground, fontSize: t.fontSize.sm }}
          >
            {pond.location}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}
          >
            {pond.size_sqm}m² × {pond.depth_m}m
          </Text>
        </View>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      flex: 1.3,
      render: (pond) => (
        <Badge variant={pond.status === 'active' ? 'default' : 'secondary'}>{pond.status}</Badge>
      ),
    },
    {
      key: 'conditions',
      label: 'Current Conditions',
      flex: 1.4,
      minWidth: 170,
      render: (pond) =>
        pond.status === 'active' && pond.temperature !== undefined ? (
          <View style={{ gap: t.spacing.xs }}>
            {alertCount > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: t.spacing.sm,
                }}
              >
                <Text style={{ color: t.colors.foreground, fontSize: t.fontSize.xs }}>
                  {Number(pond.temperature).toFixed(1)}°C
                </Text>
                <Text style={{ color: t.colors.foreground, fontSize: t.fontSize.xs }}>
                  pH {Number(pond.ph).toFixed(1)}
                </Text>
                <Text style={{ color: t.colors.foreground, fontSize: t.fontSize.xs }}>
                  Hum {Number(pond.humidity).toFixed(0)}%
                </Text>
                <Text style={{ color: t.colors.foreground, fontSize: t.fontSize.xs }}>
                  Lvl {Number(pond.water_level).toFixed(1)}m
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>Offline</Text>
        ),
    },
    {
      key: 'device',
      label: 'Sensors',
      flex: 1.1,
      render: (pond) =>
        pond.device_id ? (
          <View style={{ gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.colors.foreground,
                fontSize: t.fontSize.sm,
                fontWeight: t.fontWeight.medium,
              }}
            >
              {pond.device_name || pond.device_id}
            </Text>
            {pond.device_mac ? (
              <Text
                numberOfLines={1}
                style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}
              >
                {pond.device_mac}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>
            Not configured
          </Text>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      flex: 2.5,
      minWidth: 90,
      align: 'right',
      render: (pond) => (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            icon="create-outline"
            onPress={() => router.push(`/pond-config?id=${pond.id}`)}
          >
            Edit
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
          Manage all registered zones and their status
        </Text>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.lg }}>
        <StatCard label="Total Zones" value={ponds.length} valueColor={t.colors.foreground} />
        <StatCard label="Active" value={activeCount} valueColor={t.colors.success} />
        <StatCard label="Inactive" value={inactiveCount} valueColor={t.colors.mutedForeground} />
        <StatCard label="With Alerts" value={alertCount} valueColor={t.colors.warning} />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Ponds Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Zones</CardTitle>
          <CardDescription>View and manage registered zones</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<PondWithReadings>
            columns={columns}
            data={ponds}
            keyExtractor={(pond) => pond.id}
            emptyTitle="No zones found"
            emptyDescription="Registered zones will appear here."
          />
        </CardContent>
      </Card>
    </ScreenScroll>
  );
}
