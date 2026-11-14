/**
 * Actuator triggers screen.
 *
 * Controls arbitrary zone actuators (fans, doors, pumps, aerators) via the
 * /api/triggers endpoints.
 */
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/separator';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch, ApiError } from '@/lib/api';
import { Haptics } from '@/lib/haptics';

interface Zone {
  id: string;
  name: string;
  zone_type: string;
}

interface Schedule {
  id: number;
  zone_id?: string;
  actuator_name?: string;
  interval_minutes: number;
  duration_seconds?: number;
  active: boolean;
}

interface TriggerLog {
  id: number;
  actuator_name: string | null;
  duration_seconds: number;
  triggered_by: 'schedule' | 'manual';
  status: string;
  triggered_at: string | null;
}

interface SchedulesResponse {
  schedules?: Schedule[];
}

interface HistoryResponse {
  history?: TriggerLog[];
}

const ACTUATOR_OPTIONS = [
  { label: 'Exhaust Fan', value: 'Exhaust Fan' },
  { label: 'Vent Door', value: 'Vent Door' },
  { label: 'Water Pump', value: 'Water Pump' },
  { label: 'Aerator Pump', value: 'Aerator Pump' },
  { label: 'Solenoid Valve', value: 'Solenoid Valve' },
];

export default function TriggersScreen() {
  const t = useTheme();
  const toast = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [history, setHistory] = useState<TriggerLog[]>([]);
  const [actuatorName, setActuatorName] = useState('Exhaust Fan');
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);

  // Load zones once, then default to the first one.
  useEffect(() => {
    const loadZones = async () => {
      try {
        const res = await apiFetch<{ zones: Zone[] }>('/api/zones');
        const list = res.zones ?? [];
        setZones(list);
        if (list.length > 0) {
          setSelectedZoneId(list[0].id);
        } else {
          setLoading(false);
        }
      } catch {
        setError('Failed to load zones');
        setLoading(false);
      }
    };
    void loadZones();
  }, []);

  const fetchData = async (zoneId: string) => {
    try {
      setLoading(true);
      setError(null);
      const [schedulesData, historyData] = await Promise.all([
        apiFetch<SchedulesResponse>(`/api/triggers/schedules?zoneId=${zoneId}&init=true`),
        apiFetch<HistoryResponse>(`/api/triggers?type=history&zoneId=${zoneId}`),
      ]);
      setSchedules(schedulesData?.schedules ?? []);
      setHistory(historyData?.history ?? []);
    } catch {
      setError('Failed to load trigger data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedZoneId) {
      void (async () => {
        await fetchData(selectedZoneId);
      })();
    }
  }, [selectedZoneId]);

  const toggleSchedule = async (
    scheduleId: number,
    currentActive: boolean,
    intervalMinutes: number
  ) => {
    try {
      await apiFetch('/api/triggers/schedules', {
        method: 'PUT',
        body: { id: scheduleId, active: !currentActive },
      });

      toast.success(
        currentActive
          ? `Schedule every ${intervalMinutes}min paused`
          : `Schedule every ${intervalMinutes}min activated`
      );
      void fetchData(selectedZoneId);
    } catch (err) {
      toast.error(
        err instanceof ApiError || !(err instanceof Error)
          ? 'Failed to update schedule'
          : err.message
      );
    }
  };

  const handleTrigger = async () => {
    if (!selectedZoneId) {
      toast.error('Select a zone first');
      return;
    }

    try {
      setSending(true);
      await apiFetch('/api/triggers', {
        method: 'POST',
        body: {
          action: 'trigger',
          zoneId: selectedZoneId,
          actuatorName,
          durationSeconds: Number(duration) || 0,
        },
      });

      Haptics.success();
      toast.success(`${actuatorName} trigger sent`);
      void fetchData(selectedZoneId);
    } catch (err) {
      toast.error(
        err instanceof ApiError || !(err instanceof Error)
          ? 'Failed to trigger actuator'
          : err.message
      );
    } finally {
      setSending(false);
    }
  };

  const formatWhen = (value: string | null) => {
    if (!value) return 'Not executed yet';
    return new Date(value).toLocaleString();
  };

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        data={loading ? [] : schedules}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: t.spacing.md, paddingBottom: t.spacing.lg }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.lg, paddingBottom: t.spacing.sm }}>
            <View style={{ gap: t.spacing.xs }}>
              <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                Manual and scheduled actuator operations
              </Text>
            </View>

            {error ? <ErrorBanner message={error} /> : null}

            {/* Zone selector */}
            <Card>
              <CardHeader style={{ paddingBottom: t.spacing.sm }}>
                <Text
                  style={{
                    fontSize: t.fontSize.base,
                    fontWeight: t.fontWeight.semibold,
                    color: t.colors.cardForeground,
                  }}
                >
                  Target Zone
                </Text>
                <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                  {selectedZone ? `${selectedZone.name} • ${selectedZone.zone_type}` : 'Select a zone'}
                </Text>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedZoneId}
                  onValueChange={setSelectedZoneId}
                  options={zones.map((zone) => ({
                    label: `${zone.name} (${zone.id})`,
                    value: zone.id,
                  }))}
                  placeholder="Select a zone"
                />
              </CardContent>
            </Card>

            {/* Manual trigger */}
            <Card>
              <CardHeader style={{ paddingBottom: t.spacing.sm }}>
                <Text
                  style={{
                    fontSize: t.fontSize.base,
                    fontWeight: t.fontWeight.semibold,
                    color: t.colors.cardForeground,
                  }}
                >
                  Manual Trigger
                </Text>
                <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                  Queue an actuator run for the selected zone
                </Text>
              </CardHeader>
              <CardContent style={{ gap: t.spacing.md }}>
                <Field label="Actuator">
                  <Select
                    value={actuatorName}
                    onValueChange={setActuatorName}
                    options={ACTUATOR_OPTIONS}
                    placeholder="Select an actuator"
                  />
                </Field>
                <Field label="Duration (seconds)">
                  <Input
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="number-pad"
                    placeholder="e.g. 60"
                  />
                </Field>
                <Button
                  icon={sending ? 'checkmark-circle' : 'play'}
                  disabled={sending || !selectedZoneId}
                  loading={sending}
                  onPress={handleTrigger}
                >
                  {sending ? 'Triggering...' : `Trigger ${actuatorName}`}
                </Button>
              </CardContent>
            </Card>

            <Text
              style={{
                fontSize: t.fontSize.lg,
                fontWeight: t.fontWeight.semibold,
                color: t.colors.cardForeground,
                letterSpacing: -0.3,
              }}
            >
              {selectedZoneId ? `Trigger Schedules for Zone ${selectedZoneId}` : 'Trigger Schedules'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.md,
                padding: t.spacing.lg,
              }}
            >
              <Checkbox
                checked={item.active}
                onCheckedChange={() =>
                  toggleSchedule(item.id, item.active, item.interval_minutes)
                }
              />
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <Text
                  style={{
                    fontSize: t.fontSize.base,
                    fontWeight: t.fontWeight.medium,
                    color: t.colors.foreground,
                  }}
                >
                  {`Run ${item.actuator_name || 'actuator'} every ${item.interval_minutes} minutes`}
                </Text>
                <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                  {item.duration_seconds
                    ? `Duration ${item.duration_seconds}s`
                    : 'Uses the zone default actuator duration'}
                </Text>
              </View>
              <Badge variant={item.active ? 'default' : 'secondary'}>
                {item.active ? 'Active' : 'Disabled'}
              </Badge>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingState message="Loading..." />
          ) : (
            <EmptyState title="No schedules found for this zone." />
          )
        }
        ListFooterComponent={
          <View style={{ gap: t.spacing.md, paddingTop: t.spacing.lg }}>
            <Text
              style={{
                fontSize: t.fontSize.lg,
                fontWeight: t.fontWeight.semibold,
                color: t.colors.cardForeground,
                letterSpacing: -0.3,
              }}
            >
              Recent Triggers
            </Text>
            {history.length === 0 ? (
              <EmptyState compact title="No triggers yet" description="Manual and scheduled runs appear here." />
            ) : (
              history.slice(0, 10).map((entry) => (
                <Card key={entry.id}>
                  <View style={{ padding: t.spacing.md, gap: t.spacing.xs }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: t.spacing.sm,
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: t.fontSize.base,
                          fontWeight: t.fontWeight.medium,
                          color: t.colors.foreground,
                        }}
                      >
                        {entry.actuator_name || 'Actuator'} · {entry.duration_seconds}s
                      </Text>
                      <Badge variant={entry.status === 'completed' ? 'default' : 'secondary'}>
                        {entry.status}
                      </Badge>
                    </View>
                    <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                      {entry.triggered_by === 'manual' ? 'Manual' : 'Scheduled'} · {formatWhen(entry.triggered_at)}
                    </Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        }
      />
    </Screen>
  );
}
