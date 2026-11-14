/** Port of app/reports/page.tsx (Next.js → Expo) */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { ScreenScroll } from '@/components/screen';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { DataTable, type TableColumn } from '@/components/ui/table';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { apiTry } from '@/lib/api';
import { Haptics } from '@/lib/haptics';

interface SensorReading {
  time: string;
  temp: number;
  ph: number;
  humidity: number;
  waterLevel: number;
}

interface MetricStat {
  avg?: number | string | null;
  min?: number | string | null;
  max?: number | string | null;
  status?: string;
}

interface ReportStats {
  temperature?: MetricStat;
  ph?: MetricStat;
  humidity?: MetricStat;
  waterLevel?: MetricStat;
  summary?: {
    totalReadings?: number | string | null;
    zoneCount?: number | string | null;
  };
}

interface SummaryRow {
  metric: string;
  average: string;
  min: string;
  max: string;
  status: string;
}

type TimeFilter = 'day' | 'week' | 'month';

interface FilterConfig {
  hours: number;
  label: string;
  shortLabel: string;
  pdfLabel: string;
  summaryTitle: string;
}

const filterConfig: Record<TimeFilter, FilterConfig> = {
  day: {
    hours: 24,
    label: 'Last 24 Hours',
    shortLabel: '24 hours',
    pdfLabel: 'Last 24 Hours Analysis',
    summaryTitle: 'Daily Summary Statistics',
  },
  week: {
    hours: 168,
    label: 'Last 7 Days',
    shortLabel: '7 days',
    pdfLabel: 'Last 7 Days Analysis',
    summaryTitle: 'Weekly Summary Statistics',
  },
  month: {
    hours: 720,
    label: 'Last 30 Days',
    shortLabel: '30 days',
    pdfLabel: 'Last 30 Days Analysis',
    summaryTitle: 'Monthly Summary Statistics',
  },
};

/* Exact number formatting used by the summary cards, table and PDF export. */
const formatTemperature = (value?: number | string | null) =>
  `${(Number(value) || 0).toFixed(1)}°C`;
const formatPh = (value?: number | string | null) => (Number(value) || 0).toFixed(2);
const formatHumidityAvg = (value?: number | string | null) =>
  `${Math.round(Number(value) || 0)}%`;
const formatHumidity = (value?: number | string | null) => `${Number(value) || 0}%`;
const formatWaterLevel = (value?: number | string | null) =>
  `${(Number(value) || 0).toFixed(2)}m`;
const formatStatus = (status?: string) => status || 'Unknown';

function statusVariant(status: string): BadgeVariant {
  if (status === 'Optimal') return 'default';
  if (status === 'Normal') return 'secondary';
  return 'destructive';
}

const summaryColumns: TableColumn<SummaryRow>[] = [
  { key: 'metric', label: 'Metric', flex: 1.2 },
  { key: 'average', label: 'Average' },
  { key: 'min', label: 'Min', flex: 0.8 },
  { key: 'max', label: 'Max', flex: 0.8 },
  {
    key: 'status',
    label: 'Status',
    flex: 1.2,
    render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
  },
];

function StatCard({ title, value, caption }: { title: string; value: string; caption: string }) {
  const t = useTheme();
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1 }}>
      <CardContent style={{ gap: t.spacing.xs }}>
        <Text
          style={{
            fontSize: t.fontSize.sm,
            fontWeight: t.fontWeight.medium,
            color: t.colors.cardForeground,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: t.fontSize.xxl,
            fontWeight: t.fontWeight.bold,
            color: t.colors.cardForeground,
          }}
        >
          {value}
        </Text>
        <Text style={{ fontSize: t.fontSize.xs, color: t.colors.mutedForeground }}>{caption}</Text>
      </CardContent>
    </Card>
  );
}

export default function ReportsScreen() {
  const t = useTheme();
  const toast = useToast();

  const [chartData, setChartData] = useState<SensorReading[]>([]);
  const [summaryStats, setSummaryStats] = useState<ReportStats>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');

  const currentFilter = filterConfig[timeFilter];

  // Fetch data from APIs based on selected time filter
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        const hours = currentFilter.hours;
        const limit = timeFilter === 'month' ? 1000 : 200;

        // Fetch historical sensor data for charts
        const sensorsData = await apiTry<{ readings?: SensorReading[] }>(
          `/api/sensors/history?hours=${hours}&limit=${limit}`
        );
        if (sensorsData?.readings) {
          setChartData(sensorsData.readings);
        }

        // Fetch summary statistics
        const statsData = await apiTry<ReportStats>(`/api/reports/stats?hours=${hours}`);
        if (statsData?.temperature) {
          setSummaryStats(statsData);
        }
      } catch (error) {
        console.error('Failed to fetch reports data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter]);

  // Recharts charted 4 series (temp/ph/humidity/waterLevel); gifted-charts'
  // LineChart renders the same series through data..data4 with areaChart.
  const labelStep = Math.max(1, Math.ceil(chartData.length / 4));
  const temperatureData = chartData.map((reading, index) => ({
    value: Number(reading.temp) || 0,
    label: index % labelStep === 0 ? reading.time : '',
  }));
  const phData = chartData.map((reading) => ({ value: Number(reading.ph) || 0 }));
  const humidityData = chartData.map((reading) => ({
    value: Number(reading.humidity) || 0,
  }));
  const waterLevelData = chartData.map((reading) => ({
    value: Number(reading.waterLevel) || 0,
  }));

  const summaryRows: SummaryRow[] = [
    {
      metric: 'Temperature',
      average: isLoading ? '...' : formatTemperature(summaryStats.temperature?.avg),
      min: isLoading ? '...' : formatTemperature(summaryStats.temperature?.min),
      max: isLoading ? '...' : formatTemperature(summaryStats.temperature?.max),
      status: isLoading ? '...' : formatStatus(summaryStats.temperature?.status),
    },
    {
      metric: 'pH',
      average: isLoading ? '...' : formatPh(summaryStats.ph?.avg),
      min: isLoading ? '...' : formatPh(summaryStats.ph?.min),
      max: isLoading ? '...' : formatPh(summaryStats.ph?.max),
      status: isLoading ? '...' : formatStatus(summaryStats.ph?.status),
    },
    {
      metric: 'Humidity',
      average: isLoading ? '...' : formatHumidityAvg(summaryStats.humidity?.avg),
      min: isLoading ? '...' : formatHumidity(summaryStats.humidity?.min),
      max: isLoading ? '...' : formatHumidity(summaryStats.humidity?.max),
      status: isLoading ? '...' : formatStatus(summaryStats.humidity?.status),
    },
    {
      metric: 'Water Level',
      average: isLoading ? '...' : formatWaterLevel(summaryStats.waterLevel?.avg),
      min: isLoading ? '...' : formatWaterLevel(summaryStats.waterLevel?.min),
      max: isLoading ? '...' : formatWaterLevel(summaryStats.waterLevel?.max),
      status: isLoading ? '...' : formatStatus(summaryStats.waterLevel?.status),
    },
  ];

  /** HTML mirroring the jsPDF export (title, metadata, stats table, overview). */
  const buildReportHtml = (): string => {
    const rows: string[][] = [
      [
        'Temperature',
        formatTemperature(summaryStats.temperature?.avg),
        formatTemperature(summaryStats.temperature?.min),
        formatTemperature(summaryStats.temperature?.max),
        formatStatus(summaryStats.temperature?.status),
      ],
      [
        'pH',
        formatPh(summaryStats.ph?.avg),
        formatPh(summaryStats.ph?.min),
        formatPh(summaryStats.ph?.max),
        formatStatus(summaryStats.ph?.status),
      ],
      [
        'Humidity',
        formatHumidityAvg(summaryStats.humidity?.avg),
        formatHumidity(summaryStats.humidity?.min),
        formatHumidity(summaryStats.humidity?.max),
        formatStatus(summaryStats.humidity?.status),
      ],
      [
        'Water Level',
        formatWaterLevel(summaryStats.waterLevel?.avg),
        formatWaterLevel(summaryStats.waterLevel?.min),
        formatWaterLevel(summaryStats.waterLevel?.max),
        formatStatus(summaryStats.waterLevel?.status),
      ],
    ];

    const bodyRows = rows
      .map(
        (row, index) =>
          `<tr${index % 2 === 0 ? ' class="alt"' : ''}>` +
          row.map((cell) => `<td>${cell}</td>`).join('') +
          '</tr>'
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111111; padding: 24px; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 6px; }
  .subtitle { font-size: 13px; text-align: center; color: #555555; margin: 0 0 24px; }
  h2 { font-size: 16px; margin: 24px 0 10px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { background: #2980b9; color: #ffffff; text-align: left; padding: 6px; border: 1px solid #c8c8c8; }
  td { padding: 6px; border: 1px solid #c8c8c8; }
  tr.alt td { background: #f5f5f5; }
  ul { font-size: 13px; line-height: 1.7; padding-left: 18px; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #888888; }
</style>
</head>
<body>
  <h1>System Report</h1>
  <p class="subtitle">Generated on ${new Date().toLocaleDateString()} | ${currentFilter.pdfLabel}</p>
  <h2>Summary Statistics</h2>
  <table>
    <thead>
      <tr><th>Metric</th><th>Average</th><th>Min</th><th>Max</th><th>Status</th></tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <h2>Data Overview</h2>
  <ul>
    <li>Total Readings: ${summaryStats.summary?.totalReadings || 'N/A'}</li>
    <li>Active Zones: ${summaryStats.summary?.zoneCount || 'N/A'}</li>
    <li>Time Period: ${currentFilter.label}</li>
  </ul>
  <p class="footer">Generated by System</p>
</body>
</html>`;
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const html = buildReportHtml();
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export report',
        });
      } else {
        toast.info('PDF saved: ' + uri);
      }
      Haptics.success();
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScreenScroll>
      {/* Subtitle (page title lives in the drawer header) */}
      <View style={{ gap: t.spacing.xs }}>
        <Text style={{ fontSize: t.fontSize.sm, color: t.colors.mutedForeground }}>
          {summaryStats.summary?.totalReadings
            ? `Based on ${summaryStats.summary.totalReadings} readings from ${summaryStats.summary.zoneCount} zones over the ${currentFilter.shortLabel}`
            : 'Generate and view operational reports'}
        </Text>
      </View>

      {/* Period filter + PDF export */}
      <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Select
            value={timeFilter}
            onValueChange={(value) => setTimeFilter(value as TimeFilter)}
            options={[
              { label: 'Day', value: 'day' },
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
            ]}
            placeholder="Select period"
          />
        </View>
        <Button icon="download" disabled={isLoading} loading={isExporting} onPress={handleExportPDF}>
          Export
        </Button>
      </View>

      {/* Summary Cards (source grid-cols-4 → 2×2 wrap on mobile) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
        <StatCard
          title="Avg Temperature"
          value={isLoading ? '...' : formatTemperature(summaryStats.temperature?.avg)}
          caption={currentFilter.label}
        />
        <StatCard
          title="Avg pH"
          value={isLoading ? '...' : formatPh(summaryStats.ph?.avg)}
          caption={currentFilter.label}
        />
        <StatCard
          title="Avg Humidity"
          value={
            isLoading
              ? '...'
              : `${Math.round(Number(summaryStats.humidity?.avg) || 72)}%`
          }
          caption={currentFilter.label}
        />
        <StatCard
          title="Avg Water Level"
          value={isLoading ? '...' : formatWaterLevel(summaryStats.waterLevel?.avg)}
          caption={currentFilter.label}
        />
      </View>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>{'Temperature, Humidity, pH & Water Level Trends'}</CardTitle>
          <CardDescription>{`${currentFilter.label} trend analysis`}</CardDescription>
        </CardHeader>
        <CardContent>
          <View
            style={{ height: 200 }}
            onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
          >
            {isLoading ? (
              <LoadingState message="Loading readings…" />
            ) : chartData.length === 0 ? (
              <EmptyState
                compact
                title="No readings yet"
                description="Trends appear once sensor readings are collected."
              />
            ) : chartWidth > 0 ? (
              <LineChart
                adjustToWidth
                parentWidth={chartWidth}
                areaChart
                curved
                data={temperatureData}
                data2={phData}
                data3={humidityData}
                data4={waterLevelData}
                color={t.colors.chart3}
                color2={t.colors.chart4}
                color3={t.colors.chart1}
                color4={t.colors.chart2}
                startFillColor1={t.colors.chart3}
                endFillColor1={t.colors.chart3}
                startFillColor2={t.colors.chart4}
                endFillColor2={t.colors.chart4}
                startFillColor3={t.colors.chart1}
                endFillColor3={t.colors.chart1}
                startFillColor4={t.colors.chart2}
                endFillColor4={t.colors.chart2}
                startOpacity={0.3}
                endOpacity={0.02}
                thickness={2}
                hideDataPoints
                height={180}
                initialSpacing={0}
                noOfSections={4}
                rulesColor={t.colors.border}
                xAxisColor={t.colors.border}
                yAxisColor="transparent"
                yAxisTextStyle={{ color: t.colors.mutedForeground, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: t.colors.mutedForeground, fontSize: 10 }}
              />
            ) : null}
          </View>
        </CardContent>
      </Card>

      {/* Summary Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>{currentFilter.summaryTitle}</CardTitle>
          <CardDescription>Key metrics across all zones</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={summaryColumns}
            data={summaryRows}
            keyExtractor={(row) => row.metric}
            emptyTitle="No statistics yet"
            emptyDescription="Summary statistics appear once readings are available."
          />
        </CardContent>
      </Card>
    </ScreenScroll>
  );
}
