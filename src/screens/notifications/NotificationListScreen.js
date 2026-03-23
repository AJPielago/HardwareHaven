import React, { useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Platform } from 'react-native';
import { Card, Text, Chip, IconButton } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { fetchNotifications, markNotificationRead } from '../../store/slices/notificationSlice';
import { useResponsive } from '../../utils/responsive';

const typeColors = {
  order_update: '#2196f3',
  promotion: '#e91e63',
  general: '#666',
};

const typeIcons = {
  order_update: 'package-variant',
  promotion: 'sale',
  general: 'bell',
};

export default function NotificationListScreen({ navigation }) {
  const dispatch = useDispatch();
  const { items: notifications, loading } = useSelector((state) => state.notifications);
  const { isDesktop } = useResponsive();

  useEffect(() => {
    dispatch(fetchNotifications());
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      dispatch(fetchNotifications());
    }, [dispatch])
  );

  const handlePress = async (notification) => {
    if (!notification.isRead) {
      dispatch(markNotificationRead(notification._id));
    }

    if (notification.data?.type === 'order_update' && notification.data?.orderId) {
      navigation.navigate('OrderDetail', { id: notification.data.orderId });
    } else {
      navigation.navigate('NotificationDetail', { id: notification._id });
    }
  };

  const renderNotification = ({ item }) => (
    <Card
      style={[styles.card, !item.isRead && styles.unread, isDesktop && styles.cardDesktop]}
      onPress={() => handlePress(item)}
    >
      <Card.Content style={styles.cardContent}>
        <View style={[styles.iconContainer, { backgroundColor: typeColors[item.type] + '20' }]}>
          <IconButton icon={typeIcons[item.type] || 'bell'} iconColor={typeColors[item.type]} size={20} />
        </View>
        <View style={styles.textContent}>
          <Text variant="titleSmall" style={!item.isRead && styles.unreadText}>{item.title}</Text>
          <Text variant="bodySmall" numberOfLines={2} style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderNotification}
        style={styles.listFlex}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => dispatch(fetchNotifications())} />}
        contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No notifications</Text>}
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
  card: { marginBottom: 8 },
  cardDesktop: Platform.select({
    web: {
      boxShadow: '0 2px 10px rgba(26, 26, 46, 0.07)',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.06)',
    },
    default: {},
  }),
  unread: { backgroundColor: '#e3f2fd' },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { borderRadius: 25, marginRight: 10 },
  textContent: { flex: 1 },
  unreadText: { fontWeight: 'bold' },
  body: { color: '#666', marginTop: 2 },
  time: { color: '#999', fontSize: 11, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2196f3' },
  empty: { textAlign: 'center', marginTop: 100, color: '#999', fontSize: 16 },
});
