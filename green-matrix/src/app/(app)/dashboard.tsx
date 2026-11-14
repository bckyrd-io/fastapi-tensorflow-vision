/** Port of app/dashboard/page.tsx (Next.js → Expo) */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ScreenScroll } from '@/components/screen';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { apiTry } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Thresholds {
  temperature: { min: number; optimal: number; max: number };
  ph: { min: number; optimal: number; max: number };
  humidity: { min: number; optimal: number; max: number };
  waterLevel: { min: number; optimal: number; max: number };
}

/** Zone shape returned by GET /api/zones. */
interface Zone {
  id: string;
  name: string;
  location: string;
  zone_type: string;
  subject_name: string;
  size_sqm: number;
  depth_m: number;
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

/** Reading item returned by GET /api/sensors/latest. */
interface SensorReading {
  zone_id: string;
  temperature: number;
  ph: number;
  humidity: number;
  water_level: number;
  device_id: string;
  reading_time: string;
  zone_name: string;
  is_online?: boolean;
}

interface AlertStats {
  critical: number;
  warning: number;
  totalActive: number;
  acknowledgedToday: number;
}

interface ZonesResponse {
  zones?: Zone[];
}

interface LatestSensorsResponse {
  zones?: SensorReading[];
}

interface AlertsResponse {
  stats?: AlertStats;
}

interface ZoneConfigsResponse {
  thresholds?: Thresholds;
}

interface ThresholdRow {
  key: string;
  label: string;
  dot: string;
  normal: string;
  warning: string;
  critical: string;
}

export default function DashboardScreen() {
  const t = useTheme();
  const [zoneData, setZoneData] = useState<Zone[]>([]);
  // Sensors are fetched for their mount-guard parity with the port; no UI
  // reads this state, so bind only the setter (hole binding).
  const [, setSensorData] = useState<SensorReading[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();

  // Fetch zone, sensor, alert, and threshold data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zonesData, sensorsData, alertsData, thresholdsData] = await Promise.all([
          apiTry<ZonesResponse>('/api/zones'),
          apiTry<LatestSensorsResponse>('/api/sensors/latest'),
          apiTry<AlertsResponse>('/api/alerts?status=active&limit=1'),
          apiTry<ZoneConfigsResponse>('/api/zone-configs?aggregate=true'),
        ]);

        // The old page awaited all four fetches inside one try/catch, so a
        // failure anywhere skipped the whole update — keep that behaviour and
        // let the next 5s poll retry.
        if (!zonesData || !sensorsData || !alertsData || !thresholdsData) return;

        setZoneData(zonesData.zones || []);
        setSensorData(sensorsData.zones || []);
        setAlertCount(alertsData.stats?.totalActive || 0);

        if (thresholdsData.thresholds) {
          setThresholds(thresholdsData.thresholds);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Set up real-time updates every 5 seconds
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Calculate dynamic counts
  const activeZoneCount = zoneData.filter((z) => z.status === 'active').length;
  const inactiveZoneCount = zoneData.filter((z) => z.status === 'inactive').length;

  const thresholdRows: ThresholdRow[] = thresholds
    ? [
        {
          key: 'temperature',
          label: 'Temperature',
          dot: t.colors.success,
          normal: `${thresholds.temperature.optimal}°C ±2°C`,
          warning: `${thresholds.temperature.max}°C - ${thresholds.temperature.max + 2}°C`,
          critical: `Above ${thresholds.temperature.max + 2}°C`,
        },
        {
          key: 'ph',
          label: 'pH Levels',
          dot: t.colors.chart4,
          normal: `${thresholds.ph.optimal} ±0.5`,
          warning: `Below ${thresholds.ph.min} or above ${thresholds.ph.max}`,
          critical: 'Extremes outside optimal range',
        },
        {
          key: 'humidity',
          label: 'Humidity',
          dot: t.colors.chart1,
          normal: `${thresholds.humidity.optimal}% ±10%`,
          warning: `${thresholds.humidity.max}% - 90%`,
          critical: `Below ${thresholds.humidity.min}% or above 90%`,
        },
        {
          key: 'water',
          label: 'Water Level',
          dot: t.colors.ring,
          normal: `${thresholds.waterLevel.optimal}m ±0.3m`,
          warning: `${thresholds.waterLevel.min}m - 1.0m`,
          critical: `Below ${thresholds.waterLevel.min}m`,
        },
      ]
    : [];

  return (
    <ScreenScroll>
      {isLoading ? (
        <LoadingState message="Loading dashboard…" />
      ) : (
        <>
          {/* KPI Cards */}
          <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
            <Card style={{ flex: 1 }}>
              <CardHeader
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: t.spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: t.colors.cardForeground,
                    fontSize: t.fontSize.sm,
                    fontWeight: t.fontWeight.medium,
                  }}
                >
                  Active Zones
                </Text>
                <Ionicons name="map" size={16} color={t.colors.primary} />
              </CardHeader>
              <CardContent style={{ paddingTop: 0 }}>
                <Text
                  style={{
                    color: t.colors.cardForeground,
                    fontSize: t.fontSize.xxl,
                    fontWeight: t.fontWeight.bold,
                  }}
                >
                  {activeZoneCount}
                </Text>
                <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}>
                  {inactiveZoneCount} inactive
                </Text>
              </CardContent>
            </Card>

            <Card style={{ flex: 1 }}>
              <CardHeader
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: t.spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: t.colors.cardForeground,
                    fontSize: t.fontSize.sm,
                    fontWeight: t.fontWeight.medium,
                  }}
                >
                  Active Alerts
                </Text>
                <Ionicons name="notifications" size={16} color={t.colors.danger} />
              </CardHeader>
              <CardContent style={{ paddingTop: 0 }}>
                <Text
                  style={{
                    color: t.colors.danger,
                    fontSize: t.fontSize.xxl,
                    fontWeight: t.fontWeight.bold,
                  }}
                >
                  {alertCount}
                </Text>
                <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}>
                  Requires attention
                </Text>
              </CardContent>
            </Card>
          </View>

          {/* Reports is a dashboard sub-screen; this is its entry point. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open reports and analytics"
            onPress={() => router.push('/reports' as never)}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <Card>
              <CardHeader
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <CardTitle>Reports &amp; Analytics</CardTitle>
                  <CardDescription>
                    Trend analysis, summary statistics and PDF export
                  </CardDescription>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      color: t.colors.primary,
                      fontSize: t.fontSize.sm,
                      fontWeight: t.fontWeight.medium,
                    }}
                  >
                    View
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={t.colors.primary} />
                </View>
              </CardHeader>
            </Card>
          </Pressable>

          {zoneData.length === 0 ? (
            <EmptyState
              compact
              icon="map-outline"
              title="No zones yet"
              description="Add a zone to start tracking its sensors."
            />
          ) : null}

          {/* Threshold Key */}
          <Card>
            <CardHeader>
              <CardTitle>System Threshold Guide</CardTitle>
              <CardDescription>Understanding alert levels and meanings</CardDescription>
            </CardHeader>
            <CardContent>
              {thresholds ? (
                <View>
                  {/* Header row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: t.spacing.sm,
                      paddingVertical: t.spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: t.colors.border,
                    }}
                  >
                    <View style={{ flex: 1.6 }}>
                      <Text
                        style={{
                          fontSize: t.fontSize.xs,
                          fontWeight: t.fontWeight.semibold,
                          color: t.colors.foreground,
                        }}
                      >
                        Parameter
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: t.colors.success,
                        borderRadius: t.radius.sm,
                        paddingHorizontal: t.spacing.xs,
                        paddingVertical: t.spacing.xs,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: t.fontSize.xs,
                          fontWeight: t.fontWeight.semibold,
                          color: t.colors.successForeground,
                          textAlign: 'center',
                        }}
                      >
                        Normal
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: t.colors.warning,
                        borderRadius: t.radius.sm,
                        paddingHorizontal: t.spacing.xs,
                        paddingVertical: t.spacing.xs,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: t.fontSize.xs,
                          fontWeight: t.fontWeight.semibold,
                          color: t.colors.warningForeground,
                          textAlign: 'center',
                        }}
                      >
                        Warning
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: t.colors.destructive,
                        borderRadius: t.radius.sm,
                        paddingHorizontal: t.spacing.xs,
                        paddingVertical: t.spacing.xs,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: t.fontSize.xs,
                          fontWeight: t.fontWeight.semibold,
                          color: t.colors.destructiveForeground,
                          textAlign: 'center',
                        }}
                      >
                        Critical
                      </Text>
                    </View>
                  </View>

                  {/* Parameter rows */}
                  {thresholdRows.map((row, index) => (
                    <View
                      key={row.key}
                      style={{
                        flexDirection: 'row',
                        gap: t.spacing.sm,
                        alignItems: 'center',
                        paddingVertical: t.spacing.md,
                        borderBottomWidth: index === thresholdRows.length - 1 ? 0 : 1,
                        borderBottomColor: t.colors.border,
                      }}
                    >
                      <View
                        style={{
                          flex: 1.6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: t.spacing.sm,
                        }}
                      >
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: t.radius.full,
                            backgroundColor: row.dot,
                          }}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            color: t.colors.foreground,
                            fontSize: t.fontSize.xs,
                            fontWeight: t.fontWeight.medium,
                          }}
                        >
                          {row.label}
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          color: t.colors.foreground,
                          fontSize: t.fontSize.xs,
                        }}
                      >
                        {row.normal}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          color: t.colors.foreground,
                          fontSize: t.fontSize.xs,
                        }}
                      >
                        {row.warning}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          color: t.colors.foreground,
                          fontSize: t.fontSize.xs,
                        }}
                      >
                        {row.critical}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text
                  style={{
                    color: t.colors.mutedForeground,
                    fontSize: t.fontSize.sm,
                    textAlign: 'center',
                    paddingVertical: t.spacing.xxl,
                  }}
                >
                  No zone thresholds configured. Please configure zone settings to view threshold
                  guide.
                </Text>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </ScreenScroll>
  );
}
