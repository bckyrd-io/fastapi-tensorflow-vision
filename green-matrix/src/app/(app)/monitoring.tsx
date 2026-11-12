/** Port of app/monitoring/page.tsx (Next.js → Expo) */
import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';

import { ScreenScroll } from '@/components/screen';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';
import { apiTry } from '@/lib/api';

type SensorReading = {
  timestamp: number;
  humidity: number;
  ph: number;
  temperature: number;
  waterLevel: number; // in metres
};

/** Raw item returned by GET /api/sensors/history. */
interface HistoryReading {
  time: string;
  humidity: number;
  ph: number;
  temp: number;
  waterLevel: number;
}

interface SensorsHistoryResponse {
  readings?: HistoryReading[];
}

type MetricKey = keyof Omit<SensorReading, 'timestamp'>;
type ChartColorKey = 'chart1' | 'chart3' | 'chart4' | 'chart5';

interface ChartSpec {
  key: MetricKey;
  title: string;
  description: string;
  color: ChartColorKey;
}

// Same order and copy as the old recharts grid (Humidity, pH, Water Level,
// Temperature). Chart tokens approximate the old hex strokes: cyan/green/
// gray/red — there is no blue token, so Water Level uses chart5.
const CHART_SPECS: ChartSpec[] = [
  {
    key: 'humidity',
    title: 'Humidity Over Time',
    description: 'Relative humidity (%)',
    color: 'chart1',
  },
  {
    key: 'ph',
    title: 'pH Over Time',
    description: 'Acidity/Alkalinity levels',
    color: 'chart4',
  },
  {
    key: 'waterLevel',
    title: 'Water Level Over Time',
    description: 'Water level (metres)',
    color: 'chart5',
  },
  {
    key: 'temperature',
    title: 'Temperature Over Time',
    description: 'Air temperature (°C)',
    color: 'chart3',
  },
];

const CHART_HEIGHT = 180;
const CHART_BOX_HEIGHT = 200;
const Y_AXIS_LABEL_WIDTH = 35; // gifted-charts default (passed explicitly for our width math)
const Y_AXIS_THICKNESS = 2;
const CHART_WIDTH_SLACK = 4;
/** Minimum distance between two x-axis labels so "HH:45" never overlaps. */
const LABEL_MIN_GAP = 44;

/** Compact "HH:MM" axis label (the old app used toLocaleTimeString()). */
function formatAxisTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function MonitoringScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Fetch real sensor data from API
  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        // Fetch historical data for charts (last 24 hours, every 5 minutes)
        const data = await apiTry<SensorsHistoryResponse>('/api/sensors/history?hours=24');

        if (data && data.readings) {
          // Transform data to match chart format
          const readings = data.readings.map((reading) => ({
            timestamp: new Date(reading.time).getTime(),
            humidity: reading.humidity,
            ph: reading.ph,
            temperature: reading.temp,
            waterLevel: reading.waterLevel,
          }));

          setHistory(readings);
          setLoadError(false);
        } else if (data === null) {
          setLoadError(true);
        }
      } catch (error) {
        console.error('Failed to fetch sensor data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSensorData();

    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchSensorData, 30000);

    return () => clearInterval(interval);
  }, []);

  // Chart sizing: the chart lives inside ScreenScroll (16px page padding) and
  // CardContent (16px padding + 1px border) on each side, then gifted-charts
  // reserves the y-axis gutter before the plot area.
  const chartWidth = width - 66;
  const plotWidth = Math.max(
    chartWidth - Y_AXIS_LABEL_WIDTH - Y_AXIS_THICKNESS - CHART_WIDTH_SLACK,
    80
  );
  const pointCount = history.length;
  // Gifted-charts positions points `spacing` px apart, so derive it from the
  // available plot width and the number of readings.
  const spacing = plotWidth / Math.max(pointCount - 1, 1);
  const labelEvery = Math.max(1, Math.ceil(LABEL_MIN_GAP / spacing));

  const buildPoints = (metric: MetricKey): lineDataItem[] =>
    history.map((reading, index) => {
      const labeled =
        index % labelEvery === 0 ||
        (index === pointCount - 1 &&
          (pointCount - 1) % labelEvery > labelEvery / 2);

      if (!labeled) {
        return { value: reading[metric] };
      }

      const label = formatAxisTime(reading.timestamp);
      return {
        value: reading[metric],
        label,
        // The default x-axis label is clipped to `spacing` px (sub-pixel when
        // 24h of 5-min readings are plotted), so render our own centered label
        // that is allowed to overflow its slot.
        labelComponent: () => (
          <View style={{ alignSelf: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.colors.mutedForeground,
                fontSize: 10,
                textAlign: 'center',
              }}
            >
              {label}
            </Text>
          </View>
        ),
      };
    });

  return (
    <ScreenScroll>
      {/* Subtitle (page title lives in the drawer header) */}
      <View style={{ gap: t.spacing.xs }}>
        <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.base }}>
          Real-time sensor data visualization
        </Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading sensor history…" />
      ) : history.length === 0 ? (
        <View style={{ gap: t.spacing.md }}>
          {loadError ? <ErrorBanner message="Failed to load sensor history." /> : null}
          <EmptyState
            icon="pulse-outline"
            title="No sensor readings yet"
            description="Charts will appear as soon as sensors report data."
          />
        </View>
      ) : (
        CHART_SPECS.map((spec) => (
          <Card key={spec.key}>
            <CardHeader style={{ paddingBottom: t.spacing.sm }}>
              <CardTitle>{spec.title}</CardTitle>
              <CardDescription>{spec.description}</CardDescription>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              <View style={{ height: CHART_BOX_HEIGHT }}>
                <LineChart
                  data={buildPoints(spec.key)}
                  areaChart
                  curved
                  color={t.colors[spec.color]}
                  startFillColor={t.colors[spec.color]}
                  endFillColor={t.colors[spec.color]}
                  startOpacity={0.3}
                  endOpacity={0.02}
                  thickness={2}
                  height={CHART_HEIGHT}
                  initialSpacing={0}
                  endSpacing={0}
                  noOfSections={4}
                  spacing={spacing}
                  parentWidth={chartWidth}
                  disableScroll
                  hideDataPoints
                  rulesColor={t.colors.border}
                  xAxisColor={t.colors.border}
                  yAxisColor="transparent"
                  yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                  yAxisThickness={Y_AXIS_THICKNESS}
                  yAxisTextStyle={{ color: t.colors.mutedForeground, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: t.colors.mutedForeground, fontSize: 10 }}
                />
              </View>
            </CardContent>
          </Card>
        ))
      )}
    </ScreenScroll>
  );
}
