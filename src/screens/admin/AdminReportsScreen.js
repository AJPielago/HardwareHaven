import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { exportSalesReportPdfAsync } from '../../utils/printWeb';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSalesReport } from '../../store/slices/adminSlice';
import { formatPeso } from '../../utils/currency';

const ranges = ['7d', '30d', '90d', 'all'];

const barWidth = (value, max) => {
  if (!max || max <= 0) return '0%';
  const pct = Math.max(6, Math.round((Number(value || 0) / max) * 100));
  return `${pct}%`;
};

function LineGraph({ points, labels, color = '#2563eb' }) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 120;
  const maxValue = Math.max(1, ...points.map((value) => Number(value || 0)));

  const plotted = useMemo(() => {
    if (chartWidth <= 0 || points.length === 0) return [];
    return points.map((value, index) => {
      const x = points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth;
      const y = chartHeight - (Number(value || 0) / maxValue) * (chartHeight - 12) - 6;
      return { x, y };
    });
  }, [chartWidth, points, maxValue]);

  const segments = useMemo(() => {
    if (plotted.length < 2) return [];
    return plotted.slice(0, -1).map((point, index) => {
      const next = plotted[index + 1];
      const centerX = (point.x + next.x) / 2;
      const centerY = (point.y + next.y) / 2;
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      return {
        key: `seg-${index}`,
        left: centerX - length / 2,
        top: centerY - 1,
        width: length,
        angle,
      };
    });
  }, [plotted]);

  return (
    <View>
      <View style={styles.lineChartBox} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.lineSegment,
              {
                left: segment.left,
                top: segment.top,
                width: segment.width,
                backgroundColor: color,
                transform: [{ rotate: `${segment.angle}deg` }],
              },
            ]}
          />
        ))}
        {plotted.map((point, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.lineDot,
              {
                left: point.x - 4,
                top: point.y - 4,
                backgroundColor: color,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.lineLabelsRow}>
        {labels.map((label, index) => (
          <Text key={`lbl-${index}`} style={styles.lineLabelText}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

export default function AdminReportsScreen() {
  const dispatch = useDispatch();
  const { salesReport, loading } = useSelector((state) => state.admin);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    dispatch(fetchSalesReport(range));
  }, [dispatch, range]);

  const exportReport = async () => {
    if (!salesReport) return;
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportSalesReportPdfAsync(salesReport, `sales-report-${range}-${stamp}.pdf`);
      Alert.alert('Export Complete', 'Your PDF report has been generated.');
    } catch (err) {
      if (String(err?.name || '') === 'AbortError') {
        return;
      }
      Alert.alert('Export Failed', String(err));
    }
  };

  const summary = salesReport?.summary;
  const topProducts = salesReport?.topProducts || [];
  const dailySales = salesReport?.dailySales || [];
  const topProductMax = Math.max(1, ...topProducts.map((p) => Number(p.quantitySold || 0)));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="titleMedium" style={styles.title}>Sales Report</Text>
      <View style={styles.rangeRow}>
        {ranges.map((item) => (
          <Chip
            key={item}
            selected={range === item}
            onPress={() => setRange(item)}
            style={styles.rangeChip}
          >
            {item.toUpperCase()}
          </Chip>
        ))}
      </View>

      {summary && (
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}><Card.Content><Text style={styles.statLabel}>Revenue</Text><Text style={styles.statValue}>{formatPeso(summary.revenue)}</Text></Card.Content></Card>
          <Card style={styles.statCard}><Card.Content><Text style={styles.statLabel}>Orders</Text><Text style={styles.statValue}>{summary.totalOrders}</Text></Card.Content></Card>
          <Card style={styles.statCard}><Card.Content><Text style={styles.statLabel}>Customers</Text><Text style={styles.statValue}>{summary.uniqueCustomers}</Text></Card.Content></Card>
          <Card style={styles.statCard}><Card.Content><Text style={styles.statLabel}>Avg Order</Text><Text style={styles.statValue}>{formatPeso(summary.averageOrderValue)}</Text></Card.Content></Card>
        </View>
      )}

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>Daily Revenue</Text>
          <LineGraph
            points={dailySales.map((d) => Number(d.revenue || 0))}
            labels={dailySales.map((d) => new Date(d.day).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }))}
            color="#2563eb"
          />
          <View style={styles.topListWrap}>
            {dailySales.map((d) => (
              <View key={`daily-row-${d.day}`} style={styles.row}>
                <Text style={{ flex: 1 }}>{new Date(d.day).toLocaleDateString('en-PH')}</Text>
                <Text>{formatPeso(d.revenue)}</Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text variant="titleSmall">Top Products</Text>
          {topProducts.slice(0, 10).map((p, idx) => (
            <View key={`${p.productId || idx}`} style={styles.chartRow}>
              <Text style={styles.chartLabel} numberOfLines={1}>#{idx + 1}</Text>
              <View style={styles.chartTrack}>
                <View style={[styles.chartBar, { width: barWidth(p.quantitySold, topProductMax), backgroundColor: '#8b5cf6' }]} />
              </View>
              <Text style={styles.chartValue}>{p.quantitySold} sold</Text>
            </View>
          ))}
          <View style={styles.topListWrap}>
            {topProducts.slice(0, 10).map((p, idx) => (
              <View key={`top-list-${p.productId || idx}`} style={styles.row}>
                <Text style={{ flex: 1 }}>{p.name}</Text>
                <Text>{p.quantitySold} sold</Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="file-pdf-box"
        style={styles.button}
        loading={loading}
        onPress={exportReport}
        disabled={!salesReport}
      >
        Export PDF
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 12, paddingBottom: 30 },
  title: { fontWeight: 'bold', marginBottom: 8 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  rangeChip: { marginRight: 8, marginBottom: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', marginBottom: 10 },
  statLabel: { color: '#666' },
  statValue: { marginTop: 4, fontWeight: 'bold', fontSize: 18 },
  sectionTitle: { marginBottom: 8, fontWeight: '600' },
  sectionCard: { marginTop: 4 },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chartLabel: { width: 72, color: '#444', fontSize: 12 },
  chartTrack: { flex: 1, height: 12, backgroundColor: '#eef1f5', borderRadius: 8, overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: 8 },
  chartValue: { width: 110, textAlign: 'right', color: '#374151', fontSize: 12, fontWeight: '600' },
  lineChartBox: {
    height: 120,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    marginBottom: 8,
  },
  lineSegment: { position: 'absolute', height: 2, borderRadius: 2 },
  lineDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  lineLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineLabelText: { fontSize: 11, color: '#6b7280' },
  topListWrap: { marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  button: { marginTop: 14 },
});