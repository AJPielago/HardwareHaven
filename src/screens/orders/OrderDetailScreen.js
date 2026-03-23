import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Chip, Divider, Button, Menu } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrder, updateOrderStatus } from '../../store/slices/orderSlice';
import { getImageUrl } from '../../api/config';

const statusColors = {
  pending: '#ff9800', confirmed: '#2196f3', processing: '#9c27b0',
  shipped: '#00bcd4', delivered: '#4caf50', cancelled: '#f44336',
};
const statusFlow = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function OrderDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const dispatch = useDispatch();
  const { currentOrder: order } = useSelector((state) => state.orders);
  const { user } = useSelector((state) => state.auth);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchOrder(id));
  }, [id]);

  const handleUpdateStatus = async (status) => {
    setMenuVisible(false);
    try {
      await dispatch(updateOrderStatus({ id, status })).unwrap();
      Alert.alert('Success', `Status updated to ${status}`);
    } catch (err) {
      Alert.alert('Error', err || 'Failed to update status');
    }
  };

  if (!order) return <View style={styles.center}><Text>Loading...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge">Order #{order._id.slice(-8)}</Text>
        <Chip style={{ backgroundColor: statusColors[order.status] + '20' }}
          textStyle={{ color: statusColors[order.status] }}>
          {order.status.toUpperCase()}
        </Chip>
      </View>

      <Text style={styles.date}>Placed on {new Date(order.createdAt).toLocaleString()}</Text>

      {user?.role === 'admin' && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button mode="contained" onPress={() => setMenuVisible(true)} style={styles.updateBtn}>
              Update Status
            </Button>
          }
        >
          {statusFlow
            .filter((s) => statusFlow.indexOf(s) > statusFlow.indexOf(order.status))
            .map((s) => (
              <Menu.Item key={s} onPress={() => handleUpdateStatus(s)} title={s.charAt(0).toUpperCase() + s.slice(1)} />
            ))}
          <Divider />
          <Menu.Item onPress={() => handleUpdateStatus('cancelled')} title="Cancel Order" />
        </Menu>
      )}

      <Divider style={styles.divider} />

      <Text variant="titleMedium" style={styles.sectionTitle}>Items</Text>
      {order.items.map((item, index) => (
        <Card key={index} style={styles.itemCard}>
          <Card.Content style={styles.itemContent}>
            <View style={styles.itemInfo}>
              <Text variant="titleSmall" numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemMeta}>Qty: {item.quantity} × ₱{item.price?.toFixed(2)}</Text>
              <Text style={styles.itemSubtotal}>₱{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
            {order.status === 'delivered' && (
              <Button
                mode="outlined"
                compact
                onPress={() => navigation.navigate('HomeStack', {
                  screen: 'ReviewForm',
                  params: {
                    productId: item.product?._id || item.product,
                    orderId: order._id,
                  },
                })}
              >
                Review
              </Button>
            )}
          </Card.Content>
        </Card>
      ))}

      <Divider style={styles.divider} />

      <View style={styles.totalRow}>
        <Text variant="titleMedium">Total Amount:</Text>
        <Text variant="headlineSmall" style={styles.total}>₱{order.totalAmount.toFixed(2)}</Text>
      </View>

      <Text variant="titleMedium" style={styles.sectionTitle}>Shipping Address</Text>
      <Text style={styles.address}>{order.shippingAddress}</Text>

      <Text variant="titleMedium" style={styles.sectionTitle}>Payment Method</Text>
      <Text style={styles.payment}>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Credit Card'}</Text>

      {order.statusHistory && order.statusHistory.length > 0 && (
        <>
          <Divider style={styles.divider} />
          <Text variant="titleMedium" style={styles.sectionTitle}>Status History</Text>
          {order.statusHistory.map((entry, idx) => (
            <View key={idx} style={styles.historyItem}>
              <View style={[styles.historyDot, { backgroundColor: statusColors[entry.status] || '#999' }]} />
              <View style={styles.historyContent}>
                <Text style={{ fontWeight: 'bold' }}>{entry.status?.toUpperCase()}</Text>
                <Text style={styles.historyNote}>{entry.note}</Text>
                <Text style={styles.historyDate}>{new Date(entry.date).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: '#999', marginTop: 5 },
  updateBtn: { marginTop: 10 },
  divider: { marginVertical: 15 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 10 },
  itemCard: { marginBottom: 8 },
  itemContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemMeta: { color: '#666', marginTop: 2 },
  itemSubtotal: { fontWeight: 'bold', color: '#e91e63', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: '#e91e63', fontWeight: 'bold' },
  address: { color: '#555', marginBottom: 15 },
  payment: { color: '#555', textTransform: 'capitalize' },
  historyItem: { flexDirection: 'row', marginBottom: 12 },
  historyDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: 10 },
  historyContent: { flex: 1 },
  historyNote: { color: '#666', fontSize: 12 },
  historyDate: { color: '#999', fontSize: 11, marginTop: 2 },
});
