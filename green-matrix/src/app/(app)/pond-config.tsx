/** Port of app/pond-config/page.tsx (Next.js → Expo) */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ScreenScroll } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
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

interface Pond {
  id: string;
  name: string;
  location: string;
  size_sqm: number;
  depth_m: number;
  species: string;
  status: string;
}

interface PondConfig {
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

/**
 * The original page used raw fetch() and read the JSON body regardless of the
 * HTTP status (e.g. GET /api/ponds?id=... answers 404 "Pond not found" and the
 * page fell through to the new-pond form). apiFetch throws ApiError on !ok, so
 * unwrap the error body here to preserve that behavior; only network/parse
 * failures still propagate to the caller's catch.
 */
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

/** Mirrors the source's `errorData.error || fallback` message handling. */
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

export default function PondConfigScreen() {
  const t = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();

  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string>('');
  const [isNewPond, setIsNewPond] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('general');

  // Form state
  const [pondData, setPondData] = useState({
    name: '',
    location: '',
    size: '',
    depth: '',
    species: '',
  });

  const [configData, setConfigData] = useState({
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
  });

  // Pond to preselect from the route. The original read `?id=...`; the Expo
  // links pass `?pond=...`, so both are accepted.
  const { pond, id } = useLocalSearchParams<{ pond?: string; id?: string }>();
  const pondIdFromUrl = pond ?? id;

  const fetchPonds = async () => {
    try {
      const data = await apiFetchLoose<{ ponds?: Pond[] }>('/api/ponds');
      if (Array.isArray(data.ponds)) {
        setPonds(data.ponds);
      }
    } catch (err) {
      console.error('Failed to fetch ponds:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAndLoadPond = async (pondId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchLoose<{ pond?: Pond }>(`/api/ponds?id=${pondId}`);

      if (data.pond) {
        // Existing pond - load data
        setIsNewPond(false);
        setPondData({
          name: data.pond.name || '',
          location: data.pond.location || '',
          size: data.pond.size_sqm?.toString() || '',
          depth: data.pond.depth_m?.toString() || '',
          species: data.pond.species || '',
        });

        // Also load config if available
        const configResData = await apiFetchLoose<{ config?: PondConfig }>(
          `/api/pond-configs?pond_id=${pondId}`
        );
        if (configResData.config) {
          setConfigData({
            temp_min: configResData.config.temp_min?.toString() || '',
            temp_optimal: configResData.config.temp_optimal?.toString() || '',
            temp_max: configResData.config.temp_max?.toString() || '',
            ph_min: configResData.config.ph_min?.toString() || '',
            ph_optimal: configResData.config.ph_optimal?.toString() || '',
            ph_max: configResData.config.ph_max?.toString() || '',
            humidity_min: configResData.config.humidity_min?.toString() || '',
            humidity_optimal: configResData.config.humidity_optimal?.toString() || '',
            humidity_max: configResData.config.humidity_max?.toString() || '',
            water_level_min: configResData.config.water_level_min?.toString() || '',
            water_level_optimal: configResData.config.water_level_optimal?.toString() || '',
            water_level_max: configResData.config.water_level_max?.toString() || '',
            device_id: configResData.config.device_id || '',
            device_name: configResData.config.device_name || '',
            device_mac: configResData.config.device_mac || '',
          });
        }
      } else {
        // New pond - clear form
        setIsNewPond(true);
        setPondData({
          name: '',
          location: '',
          size: '',
          depth: '',
          species: '',
        });
        setConfigData({
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
        });
      }
    } catch (err) {
      console.error('Failed to check pond:', err);
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

  // Fetch all ponds on component mount
  useEffect(() => {
    void (async () => {
      await fetchPonds();
    })();
  }, []);

  // Handle URL parameter for pond ID
  useEffect(() => {
    const applyUrlSelection = () => {
      if (pondIdFromUrl && ponds.length > 0) {
        // Check if the pond exists in our list
        const pondExists = ponds.some((item) => item.id === pondIdFromUrl);
        if (pondExists) {
          setSelectedPondId(pondIdFromUrl);
        }
      }
    };
    applyUrlSelection();
  }, [pondIdFromUrl, ponds]);

  // Fetch pond config when selection changes
  useEffect(() => {
    if (selectedPondId) {
      void (async () => {
        await checkAndLoadPond(selectedPondId);
      })();
    }
  }, [selectedPondId]);

  const handleSave = async () => {
    if (!selectedPondId) {
      setError('Please enter a Zone ID');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isNewPond) {
        // Create new pond
        try {
          await apiFetch('/api/ponds', {
            method: 'POST',
            body: {
              id: selectedPondId,
              name: pondData.name,
              location: pondData.location,
              size: parseFloat(pondData.size) || 500,
              depth: parseFloat(pondData.depth) || 1.5,
              species: pondData.species || 'Tilapia',
            },
          });
        } catch (err) {
          throw new Error(saveErrorMessage(err, 'Failed to create zone'));
        }
      } else {
        // Update existing pond
        try {
          await apiFetch('/api/ponds', {
            method: 'PUT',
            body: {
              id: selectedPondId,
              name: pondData.name,
              location: pondData.location,
              size: parseFloat(pondData.size) || 0,
              depth: parseFloat(pondData.depth) || 0,
              species: pondData.species,
            },
          });
        } catch (err) {
          throw err instanceof ApiError ? new Error('Failed to save zone details') : err;
        }
      }

      // Save pond config (works for both new and existing)
      try {
        await apiFetch('/api/pond-configs', {
          method: 'PUT',
          body: {
            pond_id: selectedPondId,
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

      setIsNewPond(false);
      toast.success(isNewPond ? 'Zone created successfully!' : 'Configuration saved successfully!');
      Haptics.success();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (notAdmin) {
    return <LoadingState message="Redirecting…" />;
  }

  if (loading) {
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

      {/* Select Pond */}
      <Card>
        <CardContent style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Select
                value={selectedPondId}
                onValueChange={(value) => setSelectedPondId(value)}
                options={ponds.map((item) => ({ label: `${item.name} (${item.id})`, value: item.id }))}
                placeholder="Select a zone or new..."
              />
            </View>
            {isNewPond && selectedPondId ? <Badge variant="secondary">New Zone</Badge> : null}
          </View>
          {selectedPondId ? (
            <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm }}>
              {isNewPond
                ? `Will create new zone "${selectedPondId}"`
                : `Editing existing zone "${selectedPondId}"`}
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
                    value={pondData.name}
                    onChangeText={(text) => setPondData({ ...pondData, name: text })}
                    autoCapitalize="words"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Location/Zone">
                  <Input
                    value={pondData.location}
                    onChangeText={(text) => setPondData({ ...pondData, location: text })}
                    autoCapitalize="words"
                  />
                </Field>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Field label="Zone Size (m²)">
                  <Input
                    value={pondData.size}
                    onChangeText={(text) => setPondData({ ...pondData, size: text })}
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Average Depth (m)">
                  <Input
                    value={pondData.depth}
                    onChangeText={(text) => setPondData({ ...pondData, depth: text })}
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>
            </View>
            <Field label="Fish Species">
              <Input
                value={pondData.species}
                onChangeText={(text) => setPondData({ ...pondData, species: text })}
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
