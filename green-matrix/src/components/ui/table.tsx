/**
 * DataTable — replaces the shadcn Table (Code with Beto). Renders a fixed
 * header row and flex-weighted columns with an intentional empty state.
 *
 * Responsive: every column has a minimum width, and the header + rows share
 * a single horizontal ScrollView. When the container is narrower than the
 * table's total minimum, the table scrolls sideways instead of squashing
 * cells; at normal widths it fills the container exactly as before.
 *
 * Rows are mapped, not a FlatList: this list never scrolls vertically
 * itself (scrollEnabled was false — the page scroll provides that), and a
 * vertical list cannot live inside the horizontal scroller (RN invariant).
 */
import { useState } from 'react';
import { ScrollView, Text, View, type ViewStyle } from 'react-native';

import { EmptyState } from '@/components/ui/states';
import { useTheme } from '@/hooks/use-theme';

export interface TableColumn<T> {
  key: string;
  label: string;
  /** Flex weight of the column (default 1). */
  flex?: number;
  /** Minimum rendered width (px) before the table scrolls sideways (default 100). */
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  /** Custom cell renderer; defaults to String(item[key]). */
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  /** Rendered as full rows (e.g. action buttons) after the cells. */
  ListFooterComponent?: React.ComponentType;
  emptyTitle?: string;
  emptyDescription?: string;
  contentStyle?: ViewStyle;
}

const DEFAULT_MIN_WIDTH = 100;

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  ListFooterComponent,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Data will appear as soon as it is available.',
  contentStyle,
}: DataTableProps<T>) {
  const t = useTheme();
  const [availableWidth, setAvailableWidth] = useState(0);

  const columnGap = t.spacing.sm;
  const totalMinWidth =
    columns.reduce((sum, column) => sum + (column.minWidth ?? DEFAULT_MIN_WIDTH), 0) +
    columnGap * (columns.length - 1);
  // Fill the container when it fits; keep the minimum and scroll when it doesn't.
  const tableWidth = Math.max(availableWidth, totalMinWidth);

  const alignStyle = (align: TableColumn<T>['align']) =>
    align === 'right'
      ? { textAlign: 'right' as const }
      : align === 'center'
        ? { textAlign: 'center' as const }
        : { textAlign: 'left' as const };

  const renderHeaderCell = (column: TableColumn<T>) => (
    <View key={column.key} style={{ flex: column.flex ?? 1, minWidth: column.minWidth ?? DEFAULT_MIN_WIDTH }}>
      <Text
        style={[
          {
            color: t.colors.mutedForeground,
            fontSize: t.fontSize.xs,
            fontWeight: t.fontWeight.semibold,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          },
          alignStyle(column.align),
        ]}
      >
        {column.label}
      </Text>
    </View>
  );

  const renderRow = (item: T, index: number) => (
    <View
      key={keyExtractor(item)}
      style={{
        flexDirection: 'row',
        gap: columnGap,
        alignItems: 'center',
        paddingVertical: t.spacing.md,
        borderBottomWidth: index === data.length - 1 ? 0 : 1,
        borderBottomColor: t.colors.border,
      }}
    >
      {columns.map((column) => (
        <View
          key={column.key}
          style={{ flex: column.flex ?? 1, minWidth: column.minWidth ?? DEFAULT_MIN_WIDTH }}
        >
          {column.render ? (
            column.render(item)
          ) : (
            <Text
              numberOfLines={2}
              style={[
                { color: t.colors.foreground, fontSize: t.fontSize.sm },
                alignStyle(column.align),
              ]}
            >
              {String((item as Record<string, unknown>)[column.key] ?? '')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[{ width: tableWidth }, contentStyle]}>
          <View
            style={{
              flexDirection: 'row',
              gap: columnGap,
              paddingVertical: t.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: t.colors.border,
            }}
          >
            {columns.map(renderHeaderCell)}
          </View>

          {data.map(renderRow)}

          {ListFooterComponent && data.length > 0 ? <ListFooterComponent /> : null}
        </View>
      </ScrollView>

      {data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} compact />
      ) : null}
    </View>
  );
}
