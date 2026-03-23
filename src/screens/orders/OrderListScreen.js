import React, { useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Platform } from 'react-native';
import { Card, Text, Chip, Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyOrders } from '../../store/slices/orderSlice';
import { useResponsive } from '../../utils/responsive';

const statusColors = {
  pending: '#ff9800',
  confirmed: '#2196f3',
  processing: '#9c27b0',
  shipped: '#00bcd4',
  delivered: '#4caf50',
  cancelled: '#f44336',
};

export default function OrderListScreen({ navigation }) {
  const dispatch = useDispatch();
  const { items: orders, loading } = useSelector((state) => state.orders);
  const { isDesktop } = useResponsive();

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, []);

  const renderOrder = ({ item }) => (
    <Card
      style={[styles.card, isDesktop && styles.cardDesktop]}
      onPress={() => navigation.navigate('OrderDetail', { id: item._id })}
    >
      <Card.Content>
        <View style={styles.orderHeader}>
          <Text variant="titleSmall">Order #{item._id.slice(-8)}</Text>
          <Chip
            compact
            style={{ backgroundColor: statusColors[item.status] + '20' }}
            textStyle={{ color: statusColors[item.status], fontSize: 11 }}
          >
            {item.status.toUpperCase()}
          </Chip>
        </View>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        <Text style={styles.items}>{item.items.length} item{item.items.length > 1 ? 's' : ''}</Text>
        <View style={styles.totalRow}>
          <Text variant="titleMedium" style={styles.total}>₱{item.totalAmount.toFixed(2)}</Text>
          <Button mode="text" compact onPress={() => navigation.navigate('OrderDetail', { id: item._id })}>
            View Details
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={renderOrder}
        style={styles.listFlex}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => dispatch(fetchMyOrders())} />}
        contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No orders yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listFlex: { flex: 1, width: '100%' },
  list: { padding: 10, flexGrow: 1 },
  listDesktop: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  card: { marginBottom: 10 },
  cardDesktop: Platform.select({
    web: {
      boxShadow: '0 2px 10px rgba(26, 26, 46, 0.07)',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.06)',
    },
    default: {},
  }),
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: '#999', fontSize: 12, marginTop: 4 },
  items: { color: '#666', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  total: { color: '#e91e63', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 100, color: '#999', fontSize: 16 },
});
