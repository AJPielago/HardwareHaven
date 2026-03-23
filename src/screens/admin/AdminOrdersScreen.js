import React, { useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Card, Text, Chip, Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllOrders, updateOrderStatus } from '../../store/slices/orderSlice';

const statusColors = {
  pending: '#ff9800', confirmed: '#2196f3', processing: '#9c27b0',
  shipped: '#00bcd4', delivered: '#4caf50', cancelled: '#f44336',
};

const statusFlow = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function AdminOrdersScreen({ navigation }) {
  const dispatch = useDispatch();
  const { allOrders, loading } = useSelector((state) => state.orders);

  useEffect(() => {
    dispatch(fetchAllOrders());
  }, []);

  const getNextStatus = (current) => {
    const idx = statusFlow.indexOf(current);
    if (idx === -1 || idx >= statusFlow.length - 1) return null;
    return statusFlow[idx + 1];
  };

  const handleAdvance = async (orderId, nextStatus) => {
    try {
      await dispatch(updateOrderStatus({ id: orderId, status: nextStatus })).unwrap();
      Alert.alert('Success', `Order status updated to ${nextStatus}`);
    } catch (err) {
      Alert.alert('Error', err);
    }
  };

  const renderOrder = ({ item }) => {
    const nextStatus = getNextStatus(item.status);

    return (
      <Card style={styles.card} onPress={() => navigation.navigate('OrderDetail', { id: item._id })}>
        <Card.Content>
          <View style={styles.row}>
            <Text variant="titleSmall">#{item._id.slice(-8)}</Text>
            <Chip compact style={{ backgroundColor: statusColors[item.status] + '20' }}
              textStyle={{ color: statusColors[item.status], fontSize: 11 }}>
              {item.status}
            </Chip>
          </View>
          <Text style={styles.info}>Customer: {item.user?.name || 'N/A'}</Text>
          <Text style={styles.info}>{item.items.length} items · ₱{item.totalAmount.toFixed(2)}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
          {nextStatus && item.status !== 'cancelled' && (
            <Button
              mode="contained"
              compact
              onPress={() => handleAdvance(item._id, nextStatus)}
              style={{ marginTop: 8, backgroundColor: statusColors[nextStatus] }}
            >
              Mark as {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={allOrders}
        keyExtractor={(item) => item._id}
        renderItem={renderOrder}
        refreshing={loading}
        onRefresh={() => dispatch(fetchAllOrders())}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No orders</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 10 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { color: '#666', marginTop: 3 },
  date: { color: '#999', fontSize: 11, marginTop: 3 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' },
});
