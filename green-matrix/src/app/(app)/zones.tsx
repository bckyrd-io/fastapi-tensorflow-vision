import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { ScreenScroll } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch, assetUrl } from '@/lib/api';
import { Haptics } from '@/lib/haptics';
import { useAuthStore } from '@/stores/authStore';

interface Zone {
  id: string;
  name: string;
  location: string;
  zone_type: 'greenhouse' | 'pond' | 'pen_kraal' | 'custom';
  subject_name: string;
  size_sqm: number;
  depth_m: number;
  status: string;
  latest_stage?: string;
  stage_confidence?: number | string;
  latest_image_url?: string | null;
  latest_capture_at?: string | null;
  temp_optimal?: number;
  humidity_optimal?: number;
  ph_optimal?: number;
}

const FILTER_TABS = [
  { label: 'All Zones', type: 'all' },
  { label: '🌿 Greenhouses', type: 'greenhouse' },
  { label: '🐟 Ponds', type: 'pond' },
  { label: '🐄 Kraals & Pens', type: 'pen_kraal' },
];

export default function ZonesScreen() {
  const t = useTheme();
  const { user } = useAuthStore();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    let isMounted = true;
    const fetchZones = async () => {
      try {
        const res = await apiFetch<{ zones: Zone[] }>('/api/zones');
        if (isMounted) {
          setZones(res.zones || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load farm zones');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchZones();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredZones = zones.filter((z) => {
    if (activeFilter === 'all') return true;
    return z.zone_type === activeFilter;
  });

  const greenhouseCount = zones.filter((z) => z.zone_type === 'greenhouse').length;
  const pondZoneCount = zones.filter((z) => z.zone_type === 'pond').length;
  const penCount = zones.filter((z) => z.zone_type === 'pen_kraal').length;

  if (loading) {
    return (
      <ScreenScroll>
        <LoadingState message="Loading farm zones & AI stage telemetry..." />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <View style={{ gap: t.spacing.lg, paddingBottom: t.spacing.xxl }}>
        {/* Header Summary */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: t.fontSize.xs, color: t.colors.mutedForeground }}>
              Unified management for Greenhouses, Ponds, and Kraals
            </Text>
        </View>

        {error && <ErrorBanner message={error} />}

        {/* Stat Overview Cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          <Card style={{ flex: 1, minWidth: '45%' }}>
            <CardHeader style={{ paddingBottom: 4 }}>
              <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>Total Zones</Text>
            </CardHeader>
            <CardContent>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: t.colors.primary }}>
                {zones.length}
              </Text>
            </CardContent>
          </Card>

          <Card style={{ flex: 1, minWidth: '45%' }}>
            <CardHeader style={{ paddingBottom: 4 }}>
              <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>🌿 Greenhouses</Text>
            </CardHeader>
            <CardContent>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>
                {greenhouseCount}
              </Text>
            </CardContent>
          </Card>

          <Card style={{ flex: 1, minWidth: '45%' }}>
            <CardHeader style={{ paddingBottom: 4 }}>
              <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>🐟 Ponds</Text>
            </CardHeader>
            <CardContent>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0ea5e9' }}>
                {pondZoneCount}
              </Text>
            </CardContent>
          </Card>

          <Card style={{ flex: 1, minWidth: '45%' }}>
            <CardHeader style={{ paddingBottom: 4 }}>
              <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>🐄 Pens & Kraals</Text>
            </CardHeader>
            <CardContent>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#f59e0b' }}>
                {penCount}
              </Text>
            </CardContent>
          </Card>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.type;
            return (
              <TouchableOpacity
                key={tab.type}
                onPress={() => {
                  Haptics.light();
                  setActiveFilter(tab.type);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? t.colors.primary : t.colors.border,
                  backgroundColor: active ? t.colors.accent : t.colors.card,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 'bold' : 'normal',
                    color: active ? t.colors.primary : t.colors.foreground,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Zone Cards List */}
        <View style={{ gap: t.spacing.md }}>
          {filteredZones.map((z) => (
            <Card key={z.id}>
              <CardHeader>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <CardTitle>{z.name}</CardTitle>
                    <CardDescription>
                      {`${z.zone_type} • ${z.location} • ${z.subject_name || 'Standard Batch'}`}
                    </CardDescription>
                  </View>
                  
                </View>
              </CardHeader>
              <CardContent style={{ gap: t.spacing.sm }}>
                {/* Latest captured frame for this zone */}
                {z.latest_image_url ? (
                  <Image
                    source={{ uri: assetUrl(z.latest_image_url) }}
                    contentFit="cover"
                    transition={150}
                    accessibilityLabel={`Latest camera capture for ${z.name}`}
                    style={{
                      width: '100%',
                      height: 160,
                      borderRadius: 8,
                      backgroundColor: t.colors.muted,
                    }}
                  />
                ) : null}

                {/* Stage Prediction Chip */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: t.colors.accent,
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={14} color={t.colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: t.colors.foreground }}>
                      AI Growth Stage:
                    </Text>
                  </View>
                  {z.latest_stage ? (
                    <Badge variant="default">
                      {`${z.latest_stage.toUpperCase()} ${z.stage_confidence ? `(${parseFloat(String(z.stage_confidence)).toFixed(0)}%)` : ''}`}
                    </Badge>
                  ) : (
                    <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>
                      No frames analyzed yet
                    </Text>
                  )}
                </View>

                {/* Optimal Parameters */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>
                    Target Temp: {z.temp_optimal ? `${z.temp_optimal}°C` : '24°C'}
                  </Text>
                  <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>
                    Target Humidity: {z.humidity_optimal ? `${z.humidity_optimal}%` : '70%'}
                  </Text>
                  <Text style={{ fontSize: 11, color: t.colors.mutedForeground }}>
                    Status: <Text style={{ color: '#10b981', fontWeight: 'bold' }}>{z.status}</Text>
                  </Text>
                </View>

                {/* Action Row — camera scheduling lives on the Capture screen. */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {isAdmin && (
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.light();
                        router.push(`/zone-config?zone=${z.id}` as never);
                      }}
                      style={{
                        flex: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: t.colors.border,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Ionicons name="settings-outline" size={14} color={t.colors.foreground} />
                      <Text style={{ color: t.colors.foreground, fontSize: 12 }}>Config</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>
    </ScreenScroll>
  );
}

