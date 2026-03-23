import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, Divider } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotificationDetail, markNotificationRead } from '../../store/slices/notificationSlice';

export default function NotificationDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const dispatch = useDispatch();
  const { currentNotification: notification } = useSelector((state) => state.notifications);

  useEffect(() => {
    dispatch(fetchNotificationDetail(id));
    dispatch(markNotificationRead(id));
  }, [id]);

  if (!notification) return <View style={styles.center}><Text>Loading...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>{notification.title}</Text>
      <Text style={styles.date}>{new Date(notification.createdAt).toLocaleString()}</Text>
      <Text style={styles.type}>{notification.type?.replace('_', ' ').toUpperCase()}</Text>

      <Divider style={{ marginVertical: 15 }} />

      <Text variant="bodyLarge" style={styles.body}>{notification.body}</Text>

      {notification.data?.orderId && (
        <Button
          mode="contained"
          onPress={() => navigation.navigate('OrderDetail', { id: notification.data.orderId })}
          style={styles.button}
          icon="package-variant"
        >
          View Order
        </Button>
      )}

      {notification.data?.productId && (
        <Button
          mode="contained"
          onPress={() => navigation.navigate('ProductDetail', { id: notification.data.productId })}
          style={styles.button}
          icon="shopping"
        >
          View Product
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontWeight: 'bold' },
  date: { color: '#999', marginTop: 5 },
  type: { color: '#e91e63', fontSize: 12, marginTop: 5 },
  body: { lineHeight: 24, color: '#333' },
  button: { marginTop: 20 },
});
