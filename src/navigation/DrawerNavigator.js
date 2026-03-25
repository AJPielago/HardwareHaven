import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { Avatar, Text, Divider, Badge } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { getImageUrl } from '../api/config';
import { useResponsive } from '../utils/responsive';
import ProfileMenu from './ProfileMenu';
import { brand } from '../theme/brandTheme';
import AdminOnlyGuard from '../components/auth/AdminOnlyGuard';

import HomeNavigator from './HomeNavigator';
import ProfileScreen from '../screens/auth/ProfileScreen';
import OrderListScreen from '../screens/orders/OrderListScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import NotificationListScreen from '../screens/notifications/NotificationListScreen';
import NotificationDetailScreen from '../screens/notifications/NotificationDetailScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import SendPromotionScreen from '../screens/admin/SendPromotionScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminInventoryScreen from '../screens/admin/AdminInventoryScreen';
import AdminReviewsScreen from '../screens/admin/AdminReviewsScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import CartScreen from '../screens/cart/CartScreen';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props) {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const avatarUri = getImageUrl(user?.avatar);
  const { isDesktop } = useResponsive();

  return (
    <DrawerContentScrollView {...props}>
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        {avatarUri ? (
          <Avatar.Image size={70} source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <Avatar.Icon size={70} icon="account" style={styles.avatar} />
        )}
        <Text variant="titleMedium" style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.role === 'admin' && <Text style={styles.adminBadge}>ADMIN</Text>}
      </View>
      <Divider />
      <View style={styles.drawerItems}>
        <DrawerItemList {...props} />
      </View>
      <Divider style={{ marginVertical: 10 }} />
      <DrawerItem
        label="Logout"
        icon={({ color, size }) => <Avatar.Icon size={size} icon="logout" style={{ backgroundColor: 'transparent' }} color={color} />}
        onPress={() => dispatch(logout())}
      />
    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator() {
  const { user } = useSelector((state) => state.auth);
  const { unreadCount } = useSelector((state) => state.notifications);
  const { isDesktop } = useResponsive();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        headerRight: () => <ProfileMenu />,
        drawerType: isDesktop ? 'permanent' : 'front',
        drawerStyle: isDesktop ? styles.drawerStyleDesktop : styles.drawerStyle,
        overlayColor: 'transparent',
        drawerActiveTintColor: brand.colors.primary,
        drawerInactiveTintColor: brand.colors.textMuted,
        drawerActiveBackgroundColor: '#FFF0E6',
        headerStyle: {
          backgroundColor: '#fff',
          ...Platform.select({
            web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
            default: { elevation: 2 },
          }),
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: brand.colors.navy,
        },
      }}
    >
      <Drawer.Screen
        name="HomeStack"
        component={HomeNavigator}
        options={{ title: 'Shop', drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="store" style={{ backgroundColor: 'transparent' }} color={color} /> }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="account" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Orders"
        component={OrderListScreen}
        options={{
          title: 'My Orders',
          headerShown: true,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="package-variant" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationListScreen}
        options={{
          headerShown: true,
          drawerIcon: ({ color, size }) => (
            <View>
              <Avatar.Icon size={size} icon="bell" style={{ backgroundColor: 'transparent' }} color={color} />
              {unreadCount > 0 && <Badge style={styles.badge}>{unreadCount}</Badge>}
            </View>
          ),
        }}
      />
      <Drawer.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{ title: 'Notification', headerShown: true, drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Order Details', headerShown: true, drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="CartDrawer"
        component={CartScreen}
        options={{
          title: 'My Cart',
          headerShown: true,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="cart" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      />
      <Drawer.Screen
        name="AdminDashboard"
        options={{
          title: 'Dashboard',
          headerShown: true,
          drawerItemStyle: user?.role !== 'admin' ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="view-dashboard" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      >
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <AdminDashboardScreen {...props} />
          </AdminOnlyGuard>
        )}
      </Drawer.Screen>
      <Drawer.Screen
        name="AdminOrders"
        options={{
          title: 'Manage Orders',
          headerShown: true,
          drawerItemStyle: user?.role !== 'admin' ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="clipboard-list" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      >
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <AdminOrdersScreen {...props} />
          </AdminOnlyGuard>
        )}
      </Drawer.Screen>
      <Drawer.Screen
        name="SendPromotion"
        options={{
          title: 'Send Promotion',
          headerShown: true,
          drawerItemStyle: user?.role !== 'admin' ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="sale" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      >
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <SendPromotionScreen {...props} />
          </AdminOnlyGuard>
        )}
      </Drawer.Screen>
      <Drawer.Screen
        name="AdminInventory"
        options={{
          title: 'Inventory',
          headerShown: true,
          drawerItemStyle: user?.role !== 'admin' ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="warehouse" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      >
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <AdminInventoryScreen {...props} />
          </AdminOnlyGuard>
        )}
      </Drawer.Screen>
      <Drawer.Screen
        name="AdminUsers"
        options={{
          title: 'Users',
          headerShown: true,
          drawerItemStyle: user?.role !== 'admin' ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="account-group" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      >
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <AdminUsersScreen {...props} />
          </AdminOnlyGuard>
        )}
      </Drawer.Screen>
      <Drawer.Screen
        name="AdminReviews"
        options={{
          title: 'Reviews',
          headerShown: true,
          drawerItemStyle: user?.role !== 'admin' ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="message-draw" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      >
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <AdminReviewsScreen {...props} />
          </AdminOnlyGuard>
        )}
      </Drawer.Screen>
      <Drawer.Screen
        name="AdminReports"
        options={{
          title: 'Reports',
          headerShown: true,
          drawerItemStyle: user?.role !== 'admin' ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => <Avatar.Icon size={size} icon="file-chart" style={{ backgroundColor: 'transparent' }} color={color} />,
        }}
      >
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <AdminReportsScreen {...props} />
          </AdminOnlyGuard>
        )}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerStyle: { width: 300, backgroundColor: '#F6F9FF' },
  drawerStyleDesktop: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: brand.colors.border,
    backgroundColor: '#F6F9FF',
  },
  drawerItems: {
    paddingVertical: 8,
  },
  header: { padding: 20, alignItems: 'center', marginBottom: 10, backgroundColor: '#EAF0FC' },
  headerDesktop: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 0,
    backgroundColor: '#EAF0FC',
  },
  avatar: {
    marginTop: 12,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
      default: { elevation: 2 },
    }),
  },
  name: { marginTop: 12, fontWeight: '700', color: brand.colors.navy },
  email: { color: brand.colors.textMuted, fontSize: 13, marginTop: 2 },
  adminBadge: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
    marginTop: 8,
    backgroundColor: brand.colors.navy,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    letterSpacing: 1,
  },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: brand.colors.primary },
});
