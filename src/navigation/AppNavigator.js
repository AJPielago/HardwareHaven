import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import { ActivityIndicator, View } from 'react-native';
import { checkAuth } from '../store/slices/authSlice';
import { loadCart } from '../store/slices/cartSlice';
import { fetchNotifications, addNotification } from '../store/slices/notificationSlice';
import { fetchMyOrders } from '../store/slices/orderSlice';
import { ensurePushTokenSaved, useNotificationListeners } from '../utils/notifications';
import { navigationTheme, brand } from '../theme/brandTheme';
import AuthNavigator from './AuthNavigator';
import DrawerNavigator from './DrawerNavigator';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, loading } = useSelector((state) => state.auth);
  const navigationRef = useRef();

  useEffect(() => {
    dispatch(checkAuth());
    dispatch(loadCart());
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchNotifications());
      dispatch(fetchMyOrders());

      let intervalId;
      let running = false;

      const attemptTokenRegistration = async () => {
        if (running) return;
        running = true;
        try {
          const saved = await ensurePushTokenSaved(3);
          if (saved) {
            console.log('[Push] Token registration confirmed');
            if (intervalId) clearInterval(intervalId);
          } else {
            console.log('[Push] Unable to save push token after retries. Will retry in background.');
          }
        } finally {
          running = false;
        }
      };

      // Run immediately, then retry periodically until successful.
      attemptTokenRegistration();
      intervalId = setInterval(attemptTokenRegistration, 30000);

      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }

    return undefined;
  }, [isAuthenticated]);

  // Handle notification taps - navigate to order details
  useNotificationListeners(
    (notification) => {
      // Notification received while app is open
      const data = notification.request.content.data;
      dispatch(addNotification({
        _id: Date.now().toString(),
        title: notification.request.content.title,
        body: notification.request.content.body,
        data,
        type: data?.type || 'general',
        isRead: false,
        createdAt: new Date().toISOString(),
      }));
    },
    (response) => {
      // User tapped notification - navigate to appropriate screen
      const data = response.notification.request.content.data;
      if (data?.orderId) {
        navigationRef.current?.navigate('OrderDetail', { id: data.orderId });
      } else if (data?.notificationId) {
        navigationRef.current?.navigate('NotificationDetail', { id: data.notificationId });
      }
    }
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: brand.colors.background }}>
        <ActivityIndicator size="large" color={brand.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      {isAuthenticated ? <DrawerNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
