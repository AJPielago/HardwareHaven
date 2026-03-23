import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, Chip, Divider, Button, ActivityIndicator } from 'react-native-paper';
import api from '../../api/config';

const statusColors = {
  pending: '#ff9800', confirmed: '#2196f3', processing: '#9c27b0',
  shipped: '#00bcd4', delivered: '#4caf50', cancelled: '#f44336',
};

const barWidth = (value, max) => {
  if (!max || max <= 0) return '0%';
  const pct = Math.max(6, Math.round((Number(value || 0) / max) * 100));
  return `${pct}%`;
};

function LineGraph({ points, labels, color = '#3b82f6' }) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 120;

  const maxValue = Math.max(1, ...points.map((value) => Number(value || 0)));
  const plotted = useMemo(() => {
    if (chartWidth <= 0 || points.length === 0) return [];
    return points.map((value, index) => {
      const x = points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth;
      const y = chartHeight - (Number(value || 0) / maxValue) * (chartHeight - 12) - 6;
      return { x, y, value: Number(value || 0) };
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

export default function AdminDashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data);
    } catch (err) {
      console.error('Dashboard error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (!stats) {
    return <View style={styles.center}><Text>Failed to load dashboard</Text></View>;
  }

  const statusMax = Math.max(1, ...stats.ordersByStatus.map((s) => Number(s.count || 0)));
  const dailyRevenueSeries = [...(stats.dailyOrders || [])].reverse();
  const topSoldMax = Math.max(1, ...(stats.topProducts || []).map((p) => Number(p.totalSold || 0)));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Summary Cards */}
      <View style={styles.grid}>
        <Card style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.statNumber, { color: '#1565c0' }]}>{stats.totalRevenue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { backgroundColor: '#fff3e0' }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.statNumber, { color: '#e65100' }]}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.statNumber, { color: '#2e7d32' }]}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { backgroundColor: '#fce4ec' }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.statNumber, { color: '#c62828' }]}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Customers</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Quick Stats Row */}
      <View style={styles.quickRow}>
        <Card style={[styles.quickCard, { backgroundColor: '#fff8e1' }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.quickNumber, { color: '#f57f17' }]}>{stats.pendingOrders}</Text>
            <Text style={styles.quickLabel}>Pending Orders</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.quickCard, { backgroundColor: '#e8eaf6' }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.quickNumber, { color: '#283593' }]}>{stats.newUsersThisWeek}</Text>
            <Text style={styles.quickLabel}>New Users (7d)</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Order Status Breakdown */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Order Status Breakdown</Text>
          <View style={styles.chipRow}>
            {stats.ordersByStatus.map((s) => (
              <Chip
                key={s.status}
                style={[styles.statusChip, { backgroundColor: (statusColors[s.status] || '#999') + '20' }]}
                textStyle={{ color: statusColors[s.status] || '#999', fontWeight: 'bold' }}
              >
                {s.status.charAt(0).toUpperCase() + s.status.slice(1)}: {s.count}
              </Chip>
            ))}
          </View>
          <View style={styles.chartWrap}>
            {stats.ordersByStatus.map((s) => (
              <View key={`status-bar-${s.status}`} style={styles.chartRow}>
                <Text style={styles.chartLabel}>{s.status}</Text>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        width: barWidth(s.count, statusMax),
                        backgroundColor: statusColors[s.status] || '#607d8b',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartValue}>{s.count}</Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Admin Actions</Text>
          <View style={styles.quickActionsRow}>
            <Button mode="outlined" compact onPress={() => navigation.navigate('AdminInventory')}>Inventory</Button>
            <Button mode="outlined" compact onPress={() => navigation.navigate('AdminUsers')}>Users</Button>
            <Button mode="outlined" compact onPress={() => navigation.navigate('AdminReviews')}>Reviews</Button>
            <Button mode="outlined" compact onPress={() => navigation.navigate('AdminReports')}>Reports</Button>
          </View>
        </Card.Content>
      </Card>

      {/* Daily Orders (Last 7 Days) */}
      {stats.dailyOrders.length > 0 && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Last 7 Days</Text>
            <LineGraph
              points={dailyRevenueSeries.map((day) => Number(day.revenue || 0))}
              labels={dailyRevenueSeries.map((day) => new Date(day.date).toLocaleDateString('en-PH', { weekday: 'short' }))}
              color="#2563eb"
            />
            <Divider style={{ marginVertical: 8 }} />
            {stats.dailyOrders.map((day) => (
              <View key={day.date} style={styles.dailyRow}>
                <Text style={styles.dailyDate}>{new Date(day.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                <Text style={styles.dailyCount}>{day.count} orders</Text>
                <Text style={styles.dailyRevenue}>₱{day.revenue.toFixed(2)}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Recent Orders */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Recent Orders</Text>
          {stats.recentOrders.map((order) => (
            <View key={order._id}>
              <View style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={styles.orderCustomer}>{order.user.name}</Text>
                  <Text style={styles.orderMeta}>{order.itemCount} items · ₱{order.totalAmount.toFixed(2)}</Text>
                  <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleString()}</Text>
                </View>
                <Chip
                  compact
                  style={{ backgroundColor: (statusColors[order.status] || '#999') + '20' }}
                  textStyle={{ color: statusColors[order.status] || '#999', fontSize: 10 }}
                >
                  {order.status}
                </Chip>
              </View>
              <Divider style={{ marginVertical: 6 }} />
            </View>
          ))}
          <Button mode="text" onPress={() => navigation.navigate('AdminOrders')} style={{ marginTop: 5 }}>
            View All Orders
          </Button>
        </Card.Content>
      </Card>

      {/* Top Products */}
      {stats.topProducts.length > 0 && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Top Selling Products</Text>
            <View style={styles.chartWrap}>
              {stats.topProducts.map((p, i) => (
                <View key={`top-product-bar-${p.productId || i}`} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>#{i + 1}</Text>
                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          width: barWidth(p.totalSold, topSoldMax),
                          backgroundColor: '#8b5cf6',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartValue}>{p.totalSold}</Text>
                </View>
              ))}
            </View>
            <Divider style={{ marginVertical: 8 }} />
            {stats.topProducts.map((p, i) => (
              <View key={p.productId || i} style={styles.productRow}>
                <Text style={styles.rank}>#{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{p.name}</Text>
                  <Text style={styles.productMeta}>{p.totalSold} sold · ₱{p.totalRevenue.toFixed(2)} revenue</Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Low Stock Alert */}
      {stats.lowStock.length > 0 && (
        <Card style={[styles.sectionCard, { borderLeftWidth: 4, borderLeftColor: '#f44336' }]}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: '#f44336' }]}>Low Stock Alert</Text>
            {stats.lowStock.map((p) => (
              <View key={p._id} style={styles.stockRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{p.name}</Text>
                  <Text style={styles.productMeta}>{p.category}</Text>
                </View>
                <Chip compact style={{ backgroundColor: p.stock === 0 ? '#ffebee' : '#fff3e0' }}
                  textStyle={{ color: p.stock === 0 ? '#c62828' : '#e65100', fontWeight: 'bold', fontSize: 12 }}>
                  {p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
                </Chip>
              </View>
            ))}
            <Button mode="text" onPress={() => navigation.navigate('HomeStack')} style={{ marginTop: 5 }}>
              Manage Products
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 12, paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', marginBottom: 10, borderRadius: 12, elevation: 2 },
  statContent: { alignItems: 'center', paddingVertical: 12 },
  statNumber: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  quickCard: { width: '48%', borderRadius: 12, elevation: 2 },
  quickNumber: { fontSize: 28, fontWeight: 'bold' },
  quickLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  sectionCard: { marginBottom: 12, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { marginBottom: 4 },
  chartWrap: { marginTop: 10 },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chartLabel: { width: 72, textTransform: 'capitalize', color: '#444', fontSize: 12 },
  chartTrack: { flex: 1, height: 12, backgroundColor: '#eef1f5', borderRadius: 8, overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: 8 },
  chartValue: { width: 64, textAlign: 'right', color: '#374151', fontSize: 12, fontWeight: '600' },
  lineChartBox: {
    height: 120,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    marginBottom: 8,
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
  },
  lineDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lineLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineLabelText: { fontSize: 11, color: '#6b7280' },
  dailyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  dailyDate: { flex: 1, color: '#555', fontSize: 13 },
  dailyCount: { color: '#666', fontSize: 13, marginRight: 12 },
  dailyRevenue: { color: '#2e7d32', fontWeight: 'bold', fontSize: 13 },
  orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  orderCustomer: { fontWeight: '600' },
  orderMeta: { color: '#666', fontSize: 12 },
  orderDate: { color: '#999', fontSize: 11 },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  rank: { fontSize: 16, fontWeight: 'bold', color: '#e91e63', marginRight: 12, width: 28 },
  productMeta: { color: '#666', fontSize: 12 },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
});
