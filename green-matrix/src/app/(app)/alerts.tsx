/** Port of app/alerts/page.tsx (Next.js → Expo) */
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch, ApiError } from '@/lib/api';

interface Alert {
  id: number;
  zone_id: string;
  zone_name: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  source: 'trigger' | 'sensor' | 'config' | 'user' | 'system';
  status: 'active' | 'inactive';
  value: number | null;
  parameter: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

interface AlertStats {
  critical: number;
  warning: number;
  totalActive: number;
  acknowledgedToday: number;
}

interface AlertsResponse {
  alerts?: Alert[];
  stats?: AlertStats;
}

export default function AlertsScreen() {
  const t = useTheme();
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    critical: 0,
    warning: 0,
    totalActive: 0,
    acknowledgedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<AlertsResponse>(`/api/alerts?status=${activeTab}`);
      if (data?.alerts) {
        setAlerts(data.alerts);
      }
      if (data?.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchAlerts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const markAsRead = async (alertId: number) => {
    try {
      await apiFetch('/api/alerts', {
        method: 'PUT',
        body: { id: alertId },
      });
      toast.success('Alert marked as read');
      fetchAlerts();
    } catch (err) {
      // The old app stayed silent on non-2xx responses here.
      if (!(err instanceof ApiError)) {
        toast.error('Failed to mark alert as read');
      }
      console.error('Failed to mark alert as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/alerts', {
        method: 'DELETE',
      });
      toast.success(`Marked ${stats.totalActive} alerts as read`);
      fetchAlerts();
    } catch (err) {
      // The old app stayed silent on non-2xx responses here.
      if (!(err instanceof ApiError)) {
        toast.error('Failed to mark all alerts as read');
      }
      console.error('Failed to mark all as read:', err);
    }
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      trigger: 'Trigger',
      sensor: 'Sensor',
      config: 'Configuration',
      user: 'User',
      system: 'System',
    };
    return labels[source] || source;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'critical':
        return t.colors.destructive;
      case 'warning':
        return t.colors.warning;
      default:
        return t.colors.chart1;
    }
  };

  const getBadgeVariant = (type: string): BadgeVariant => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const renderAlert = ({ item }: { item: Alert }) => {
    const isActive = activeTab === 'active';
    const timeText = isActive
      ? formatTime(item.created_at)
      : `Created: ${formatTime(item.created_at)}` +
        (item.acknowledged_at
          ? ` • Acknowledged: ${formatTime(item.acknowledged_at)}`
          : '');

    return (
      <Card style={isActive ? undefined : { opacity: 0.7 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: t.spacing.md,
            padding: t.spacing.lg,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: t.radius.full,
              backgroundColor: getTypeColor(item.type),
              marginTop: 2,
            }}
          />
          <View style={{ flex: 1, gap: t.spacing.xs }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: t.spacing.sm,
              }}
            >
              <Badge variant={getBadgeVariant(item.type)}>{capitalize(item.type)}</Badge>
              <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
                {item.zone_name || item.zone_id}
              </Text>
              <Badge variant="outline">{getSourceLabel(item.source)}</Badge>
            </View>
            <Text
              style={{
                fontSize: t.fontSize.base,
                fontWeight: t.fontWeight.medium,
                color: t.colors.foreground,
              }}
            >
              {item.message}
            </Text>
            <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
              {timeText}
            </Text>
          </View>
          {isActive ? (
            <Button variant="outline" icon="checkmark-circle" onPress={() => markAsRead(item.id)}>
              Check
            </Button>
          ) : null}
        </View>
      </Card>
    );
  };

  const statCard = (
    title: string,
    value: number,
    options?: { tint?: string; border?: string; valueColor?: string }
  ) => (
    <Card
      style={{
        flexBasis: '45%',
        flexGrow: 1,
        ...(options?.tint ? { backgroundColor: options.tint } : {}),
        ...(options?.border ? { borderColor: options.border } : {}),
      }}
    >
      <CardHeader style={{ paddingBottom: t.spacing.sm }}>
        <Text
          style={{
            fontSize: t.fontSize.sm,
            fontWeight: t.fontWeight.medium,
            color: options?.valueColor ?? t.colors.cardForeground,
          }}
        >
          {title}
        </Text>
      </CardHeader>
      <CardContent style={{ paddingTop: 0, paddingBottom: t.spacing.md }}>
        <Text
          style={{
            fontSize: t.fontSize.xxxl,
            fontWeight: t.fontWeight.bold,
            color: options?.valueColor ?? t.colors.cardForeground,
          }}
        >
          {value}
        </Text>
      </CardContent>
    </Card>
  );

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        data={loading ? [] : alerts}
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
                  Monitor and manage system alerts
                </Text>
              </View>
              <Button
                icon="checkmark-circle"
                disabled={stats.totalActive === 0}
                onPress={markAllAsRead}
              >
                Read all
              </Button>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
              {statCard('Critical Alerts', stats.critical, {
                tint: `${t.colors.destructive}14`,
                border: `${t.colors.destructive}80`,
                valueColor: t.colors.destructive,
              })}
              {statCard('Warnings', stats.warning, {
                tint: `${t.colors.warning}14`,
                border: `${t.colors.warning}80`,
                valueColor: t.colors.warning,
              })}
              {statCard('Acknowledged Today', stats.acknowledgedToday, {
                valueColor: t.colors.success,
              })}
              {statCard('Total Active', stats.totalActive)}
            </View>

            <Tabs
              items={[
                { value: 'active', label: 'Active Alerts' },
                { value: 'inactive', label: 'History' },
              ]}
              value={activeTab}
              onValueChange={setActiveTab}
            />
          </View>
        }
        renderItem={renderAlert}
        ListEmptyComponent={
          loading ? (
            <LoadingState
              message={activeTab === 'active' ? 'Loading alerts...' : 'Loading history...'}
            />
          ) : activeTab === 'active' ? (
            <EmptyState
              icon="notifications-outline"
              title="No active alerts"
              description="All systems are operating normally"
            />
          ) : (
            <EmptyState
              icon="time-outline"
              title="No alert history"
              description="Acknowledged alerts will appear here"
            />
          )
        }
      />
    </Screen>
  );
}
