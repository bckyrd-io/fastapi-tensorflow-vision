/**
 * Zone configuration editor — details, device metadata and sensor thresholds.
 * Replaces the old configuration screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ScreenScroll } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch } from '@/lib/api';
import { Haptics } from '@/lib/haptics';
import { useAuthStore } from '@/stores/authStore';

interface Zone {
  id: string;
  name: string;
  location: string;
  zone_type: string;
  subject_name: string;
  size_sqm: number;
  depth_m: number;
  status: string;
}

interface ZoneConfig {
  temp_min: number;
  temp_optimal: number;
  temp_max: number;
  ph_min: number;
  ph_optimal: number;
  ph_max: number;
  humidity_min: number;
  humidity_optimal: number;
  humidity_max: number;
  water_level_min: number;
  water_level_optimal: number;
  water_level_max: number;
  device_id: string;
  device_name: string;
  device_mac: string;
}

const ZONE_TYPES = [
  { label: '🌿 Greenhouse', value: 'greenhouse' },
  { label: '🐟 Pond', value: 'pond' },
  { label: '🐄 Pen / Kraal', value: 'pen_kraal' },
  { label: '🧩 Custom', value: 'custom' },
];

/** Unwrap the JSON error body instead of throwing (matches the old page). */
async function apiFetchLoose<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body;
      return (body !== null && typeof body === 'object' ? body : {}) as T;
    }
    throw err;
  }
}

function saveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body !== null && typeof body === 'object' && 'error' in body) {
      const message = (body as { error: unknown }).error;
      if (typeof message === 'string' && message) return message;
    }
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

const EMPTY_CONFIG = {
  temp_min: '',
  temp_optimal: '',
  temp_max: '',
  ph_min: '',
  ph_optimal: '',
  ph_max: '',
  humidity_min: '',
  humidity_optimal: '',
  humidity_max: '',
  water_level_min: '',
  water_level_optimal: '',
  water_level_max: '',
  device_id: '',
  device_name: '',
  device_mac: '',
};

export default function ZoneConfigScreen() {
  const t = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();

  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [isNewZone, setIsNewZone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('general');

  const [zoneData, setZoneData] = useState({
    name: '',
    location: '',
    zone_type: 'greenhouse',
    subject_name: '',
    size: '',
    depth: '',
    status: 'active',
  });

  const [configData, setConfigData] = useState({ ...EMPTY_CONFIG });

  // The route accepts ?zone= (preferred) and ?id=.
  const { zone, id } = useLocalSearchParams<{ zone?: string; id?: string }>();
  const zoneIdFromUrl = zone ?? id;

  const fetchZones = async () => {
    try {
      const data = await apiFetchLoose<{ zones?: Zone[] }>('/api/zones');
      if (Array.isArray(data.zones)) {
        setZones(data.zones);
        const preferred =
          zoneIdFromUrl && data.zones.some((item) => item.id === zoneIdFromUrl)
            ? zoneIdFromUrl
            : data.zones[0]?.id;
        if (preferred) {
          setSelectedZoneId((current) => current || preferred);
        }
      }
    } catch (err) {
      console.error('Failed to fetch zones:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAndLoadZone = async (zoneId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchLoose<{ zone?: Zone; config?: ZoneConfig }>(
        `/api/zones?id=${zoneId}&config=true`
      );

      if (data.zone) {
        setIsNewZone(false);
        setZoneData({
          name: data.zone.name || '',
          location: data.zone.location || '',
          zone_type: data.zone.zone_type || 'greenhouse',
          subject_name: data.zone.subject_name || '',
          size: data.zone.size_sqm?.toString() || '',
          depth: data.zone.depth_m?.toString() || '',
          status: data.zone.status || 'active',
        });

        if (data.config) {
          setConfigData({
            temp_min: data.config.temp_min?.toString() || '',
            temp_optimal: data.config.temp_optimal?.toString() || '',
            temp_max: data.config.temp_max?.toString() || '',
            ph_min: data.config.ph_min?.toString() || '',
            ph_optimal: data.config.ph_optimal?.toString() || '',
            ph_max: data.config.ph_max?.toString() || '',
            humidity_min: data.config.humidity_min?.toString() || '',
            humidity_optimal: data.config.humidity_optimal?.toString() || '',
            humidity_max: data.config.humidity_max?.toString() || '',
            water_level_min: data.config.water_level_min?.toString() || '',
            water_level_optimal: data.config.water_level_optimal?.toString() || '',
            water_level_max: data.config.water_level_max?.toString() || '',
            device_id: data.config.device_id || '',
            device_name: data.config.device_name || '',
            device_mac: data.config.device_mac || '',
          });
        } else {
          setConfigData({ ...EMPTY_CONFIG });
        }
      }
    } catch (err) {
      console.error('Failed to load zone:', err);
      setError('Failed to load zone data');
    } finally {
      setLoading(false);
    }
  };

  // Redirect non-admin users.
  const notAdmin = user?.role !== 'admin';
  useEffect(() => {
    if (notAdmin) router.replace('/dashboard');
  }, [notAdmin]);

  useEffect(() => {
    void (async () => {
      await fetchZones();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedZoneId) {
      void (async () => {
        await checkAndLoadZone(selectedZoneId);
      })();
    }
  }, [selectedZoneId]);

  const startNewZone = () => {
    Haptics.light();
    setIsNewZone(true);
    setSelectedZoneId('');
    setError(null);
    setZoneData({
      name: '',
      location: '',
      zone_type: 'greenhouse',
      subject_name: '',
      size: '',
      depth: '',
      status: 'active',
    });
    setConfigData({ ...EMPTY_CONFIG });
  };

  const handleSave = async () => {
    const targetId = isNewZone ? selectedZoneId.trim() : selectedZoneId;
    if (!targetId) {
      setError('Please enter a Zone ID');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        id: targetId,
        name: zoneData.name,
        location: zoneData.location,
        zone_type: zoneData.zone_type,
        subject_name: zoneData.subject_name,
        size: parseFloat(zoneData.size) || 0,
        depth: parseFloat(zoneData.depth) || 0,
        status: zoneData.status,
        device_id: configData.device_id,
        device_name: configData.device_name,
        device_mac: configData.device_mac,
      };

      try {
        await apiFetch('/api/zones', {
          method: isNewZone ? 'POST' : 'PUT',
          body: payload,
        });
      } catch (err) {
        throw new Error(saveErrorMessage(err, 'Failed to save zone details'));
      }

      try {
        await apiFetch('/api/zone-configs', {
          method: 'PUT',
          body: {
            zone_id: targetId,
            temp_min: parseFloat(configData.temp_min) || 0,
            temp_optimal: parseFloat(configData.temp_optimal) || 0,
            temp_max: parseFloat(configData.temp_max) || 0,
            ph_min: parseFloat(configData.ph_min) || 0,
            ph_optimal: parseFloat(configData.ph_optimal) || 0,
            ph_max: parseFloat(configData.ph_max) || 0,
            humidity_min: parseFloat(configData.humidity_min) || 0,
            humidity_optimal: parseFloat(configData.humidity_optimal) || 0,
            humidity_max: parseFloat(configData.humidity_max) || 0,
            water_level_min: parseFloat(configData.water_level_min) || 0,
            water_level_optimal: parseFloat(configData.water_level_optimal) || 0,
            water_level_max: parseFloat(configData.water_level_max) || 0,
            device_id: configData.device_id,
            device_name: configData.device_name,
            device_mac: configData.device_mac,
          },
        });
      } catch (err) {
        throw err instanceof ApiError ? new Error('Failed to save zone configuration') : err;
      }

      setIsNewZone(false);
      toast.success(isNewZone ? 'Zone created successfully!' : 'Configuration saved successfully!');
      Haptics.success();
      await fetchZones();
      setSelectedZoneId(targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (notAdmin) {
    return <LoadingState message="Redirecting…" />;
  }

  if (loading && zones.length === 0 && !isNewZone) {
    return <LoadingState message="Loading zone configuration…" />;
  }

  return (
    <ScreenScroll>
      {/* Header — the drawer header already shows the page title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <Text style={{ flex: 1, color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>
          Configure zone details, sensors, and thresholds
        </Text>
        <Button icon="save" disabled={saving} loading={saving} onPress={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Select or create a zone */}
      <Card>
        <CardContent style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Select
                value={selectedZoneId}
                onValueChange={(value) => {
                  setIsNewZone(false);
                  setSelectedZoneId(value);
                }}
                options={zones.map((item) => ({ label: `${item.name} (${item.id})`, value: item.id }))}
                placeholder="Select a zone..."
              />
            </View>
            <Button variant="outline" size="sm" icon="add" onPress={startNewZone}>
              New
            </Button>
          </View>

          {isNewZone ? (
            <Field label="New Zone ID">
              <Input
                value={selectedZoneId}
                onChangeText={setSelectedZoneId}
                placeholder="e.g. GH-03"
                autoCapitalize="characters"
              />
            </Field>
          ) : null}

          {selectedZoneId ? (
            <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>
              {isNewZone
                ? `Will create new zone "${selectedZoneId}"`
                : `Editing existing zone "${selectedZoneId}"`}
            </Text>
          ) : null}
        </CardContent>
      </Card>

      <Tabs
        items={[
          { value: 'general', label: 'General' },
          { value: 'device', label: 'Device' },
        ]}
        value={tab}
        onValueChange={setTab}
      />

      {/* General Tab */}
      <TabsContent active={tab} value="general">
        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
            <CardDescription>Basic zone details</CardDescription>
          </CardHeader>
          <CardContent style={{ gap: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Field label="Zone Name">
                  <Input
                    value={zoneData.name}
                    onChangeText={(text) => setZoneData({ ...zoneData, name: text })}
                    autoCapitalize="words"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Location">
                  <Input
                    value={zoneData.location}
                    onChangeText={(text) => setZoneData({ ...zoneData, location: text })}
                    autoCapitalize="words"
                  />
                </Field>
              </View>
            </View>

            <Field label="Zone Type">
              <Select
                value={zoneData.zone_type}
                onValueChange={(value) => setZoneData({ ...zoneData, zone_type: value })}
                options={ZONE_TYPES}
                placeholder="Select a zone type"
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Field label="Zone Size (m²)">
                  <Input
                    value={zoneData.size}
                    onChangeText={(text) => setZoneData({ ...zoneData, size: text })}
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Average Depth (m)">
                  <Input
                    value={zoneData.depth}
                    onChangeText={(text) => setZoneData({ ...zoneData, depth: text })}
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>
            </View>

            <Field label="Subject / Crop or Species">
              <Input
                value={zoneData.subject_name}
                onChangeText={(text) => setZoneData({ ...zoneData, subject_name: text })}
                autoCapitalize="words"
              />
            </Field>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Device Tab: thresholds + ESP32 fields */}
      <TabsContent active={tab} value="device">
        <View style={{ gap: t.spacing.lg }}>
          {/* Temperature Configuration */}
          <Card>
            <CardHeader style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <View
                style={{
                  backgroundColor: t.colors.muted,
                  borderRadius: t.radius.md,
                  padding: t.spacing.sm,
                }}
              >
                <Ionicons name="thermometer-outline" size={20} color={t.colors.chart2} />
              </View>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <CardTitle>Temperature Sensor</CardTitle>
                <CardDescription>Set temperature thresholds (°C)</CardDescription>
              </View>
            </CardHeader>
            <CardContent style={{ gap: t.spacing.lg }}>
              <Field label="Minimum">
                <Input
                  value={configData.temp_min}
                  onChangeText={(text) => setConfigData({ ...configData, temp_min: text })}
                  placeholder="e.g., 24"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Optimal">
                <Input
                  value={configData.temp_optimal}
                  onChangeText={(text) => setConfigData({ ...configData, temp_optimal: text })}
                  placeholder="e.g., 28"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Maximum">
                <Input
                  value={configData.temp_max}
                  onChangeText={(text) => setConfigData({ ...configData, temp_max: text })}
                  placeholder="e.g., 32"
                  keyboardType="decimal-pad"
                />
              </Field>
            </CardContent>
          </Card>

          {/* pH Configuration */}
          <Card>
            <CardHeader style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <View
                style={{
                  backgroundColor: t.colors.muted,
                  borderRadius: t.radius.md,
                  padding: t.spacing.sm,
                }}
              >
                <Ionicons name="water-outline" size={20} color={t.colors.chart1} />
              </View>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <CardTitle>pH Sensor</CardTitle>
                <CardDescription>Set pH level thresholds</CardDescription>
              </View>
            </CardHeader>
            <CardContent style={{ gap: t.spacing.lg }}>
              <Field label="Minimum">
                <Input
                  value={configData.ph_min}
                  onChangeText={(text) => setConfigData({ ...configData, ph_min: text })}
                  placeholder="e.g., 6.5"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Optimal">
                <Input
                  value={configData.ph_optimal}
                  onChangeText={(text) => setConfigData({ ...configData, ph_optimal: text })}
                  placeholder="e.g., 7.0"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Maximum">
                <Input
                  value={configData.ph_max}
                  onChangeText={(text) => setConfigData({ ...configData, ph_max: text })}
                  placeholder="e.g., 7.5"
                  keyboardType="decimal-pad"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Humidity Configuration */}
          <Card>
            <CardHeader style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <View
                style={{
                  backgroundColor: t.colors.muted,
                  borderRadius: t.radius.md,
                  padding: t.spacing.sm,
                }}
              >
                <Ionicons name="rainy-outline" size={20} color={t.colors.chart4} />
              </View>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <CardTitle>Humidity Sensor</CardTitle>
                <CardDescription>Set humidity thresholds (%)</CardDescription>
              </View>
            </CardHeader>
            <CardContent style={{ gap: t.spacing.lg }}>
              <Field label="Minimum">
                <Input
                  value={configData.humidity_min}
                  onChangeText={(text) => setConfigData({ ...configData, humidity_min: text })}
                  placeholder="e.g., 60"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Optimal">
                <Input
                  value={configData.humidity_optimal}
                  onChangeText={(text) => setConfigData({ ...configData, humidity_optimal: text })}
                  placeholder="e.g., 75"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Maximum">
                <Input
                  value={configData.humidity_max}
                  onChangeText={(text) => setConfigData({ ...configData, humidity_max: text })}
                  placeholder="e.g., 90"
                  keyboardType="decimal-pad"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Water Level Configuration */}
          <Card>
            <CardHeader style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <View
                style={{
                  backgroundColor: t.colors.muted,
                  borderRadius: t.radius.md,
                  padding: t.spacing.sm,
                }}
              >
                <Ionicons name="speedometer-outline" size={20} color={t.colors.chart5} />
              </View>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <CardTitle>Water Level Sensor</CardTitle>
                <CardDescription>Set water level thresholds (m)</CardDescription>
              </View>
            </CardHeader>
            <CardContent style={{ gap: t.spacing.lg }}>
              <Field label="Minimum">
                <Input
                  value={configData.water_level_min}
                  onChangeText={(text) => setConfigData({ ...configData, water_level_min: text })}
                  placeholder="e.g., 0.5"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Optimal">
                <Input
                  value={configData.water_level_optimal}
                  onChangeText={(text) => setConfigData({ ...configData, water_level_optimal: text })}
                  placeholder="e.g., 1.0"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Maximum">
                <Input
                  value={configData.water_level_max}
                  onChangeText={(text) => setConfigData({ ...configData, water_level_max: text })}
                  placeholder="e.g., 2.0"
                  keyboardType="decimal-pad"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Device Information */}
          <Card>
            <CardHeader style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <View
                style={{
                  backgroundColor: t.colors.muted,
                  borderRadius: t.radius.md,
                  padding: t.spacing.sm,
                }}
              >
                <Ionicons name="hardware-chip-outline" size={20} color={t.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <CardTitle>Device Information</CardTitle>
                <CardDescription>IoT device configuration</CardDescription>
              </View>
            </CardHeader>
            <CardContent style={{ gap: t.spacing.lg }}>
              <Field label="Device ID">
                <Input
                  value={configData.device_id}
                  onChangeText={(text) => setConfigData({ ...configData, device_id: text })}
                  placeholder="e.g., ESP32-001"
                />
              </Field>
              <Field label="Device Name">
                <Input
                  value={configData.device_name}
                  onChangeText={(text) => setConfigData({ ...configData, device_name: text })}
                  placeholder="e.g., Sensor Hub A"
                  autoCapitalize="words"
                />
              </Field>
              <Field label="MAC Address">
                <Input
                  value={configData.device_mac}
                  onChangeText={(text) => setConfigData({ ...configData, device_mac: text })}
                  placeholder="e.g., AA:BB:CC:DD:EE:FF"
                />
              </Field>
            </CardContent>
          </Card>
        </View>
      </TabsContent>
    </ScreenScroll>
  );
}
