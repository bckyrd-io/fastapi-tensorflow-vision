/** Port of app/feeding/page.tsx (Next.js → Expo) */
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/separator';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch, ApiError } from '@/lib/api';
import { Haptics } from '@/lib/haptics';

interface Schedule {
  id: number;
  pond_id: string;
  interval_minutes: number;
  active: boolean;
}

interface SchedulesResponse {
  schedules?: Schedule[];
}

export default function FeedingScreen() {
  const t = useTheme();
  const toast = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedPondId] = useState('P001');
  const [loading, setLoading] = useState(true);
  const [feeding, setFeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Get or create the 3 hardcoded interval schedules
      const data = await apiFetch<SchedulesResponse>(
        `/api/feeding/schedules?pondId=${selectedPondId}&init=true`
      );
      setSchedules(data?.schedules ?? []);
    } catch {
      setError('Failed to load feeding data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPondId]);

  const toggleSchedule = async (
    scheduleId: number,
    currentActive: boolean,
    intervalMinutes: number
  ) => {
    try {
      await apiFetch('/api/feeding/schedules', {
        method: 'PUT',
        body: { id: scheduleId, active: !currentActive },
      });

      toast.success(
        currentActive
          ? `Schedule every ${intervalMinutes}min paused`
          : `Schedule every ${intervalMinutes}min activated`
      );
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof ApiError || !(err instanceof Error)
          ? 'Failed to update schedule'
          : err.message
      );
    }
  };

  const handleFeedNow = async () => {
    try {
      setFeeding(true);
      await apiFetch('/api/feeding', {
        method: 'POST',
        body: {
          action: 'trigger',
          pondId: selectedPondId,
        },
      });

      Haptics.success();
      toast.success('Manual feeding triggered');
    } catch (err) {
      toast.error(
        err instanceof ApiError || !(err instanceof Error)
          ? 'Failed to trigger feeding'
          : err.message
      );
    } finally {
      setFeeding(false);
    }
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: t.spacing.md,
              }}
            >
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                  Manual and scheduled feeding operations
                </Text>
              </View>
              <Button
                icon={feeding ? 'checkmark-circle' : 'play'}
                disabled={feeding}
                onPress={handleFeedNow}
              >
                {feeding ? 'Feeding...' : 'Trigger'}
              </Button>
            </View>

            {error ? <ErrorBanner message={error} /> : null}

            <Text
              style={{
                fontSize: t.fontSize.lg,
                fontWeight: t.fontWeight.semibold,
                color: t.colors.cardForeground,
                letterSpacing: -0.3,
              }}
            >
              {`Interval Schedules for Zone ${selectedPondId}`}
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
                  {`Feed every ${item.interval_minutes} minutes`}
                </Text>
                <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                  Automatically triggers servo to dispense feed
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
      />
    </Screen>
  );
}
