import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { Menu, Avatar, Divider } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { logout } from '../store/slices/authSlice';
import { getImageUrl } from '../api/config';

export default function ProfileMenu() {
  const [visible, setVisible] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const avatarUri = getImageUrl(user?.avatar);

  const navigateTo = (screen) => {
    setVisible(false);
    navigation.navigate(screen);
  };

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <TouchableOpacity onPress={() => setVisible(true)} style={styles.avatarBtn}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <Avatar.Icon size={32} icon="account" style={styles.avatarIcon} />
          )}
        </TouchableOpacity>
      }
      anchorPosition="bottom"
      contentStyle={[styles.menu, Platform.OS === 'web' && styles.menuWeb]}
    >
      <Menu.Item
        leadingIcon="account"
        onPress={() => navigateTo('Profile')}
        title="Profile"
      />
      <Menu.Item
        leadingIcon="package-variant"
        onPress={() => navigateTo('Orders')}
        title="My Orders"
      />
      <Menu.Item
        leadingIcon="bell"
        onPress={() => navigateTo('Notifications')}
        title="Notifications"
      />
      <Menu.Item
        leadingIcon="cart"
        onPress={() => navigateTo('CartDrawer')}
        title="My Cart"
      />
      {user?.role === 'admin' && (
        <>
          <Divider />
          <Menu.Item
            leadingIcon="view-dashboard"
            onPress={() => navigateTo('AdminDashboard')}
            title="Dashboard"
          />
          <Menu.Item
            leadingIcon="clipboard-list"
            onPress={() => navigateTo('AdminOrders')}
            title="Manage Orders"
          />
          <Menu.Item
            leadingIcon="warehouse"
            onPress={() => navigateTo('AdminInventory')}
            title="Inventory"
          />
          <Menu.Item
            leadingIcon="account-group"
            onPress={() => navigateTo('AdminUsers')}
            title="Users"
          />
          <Menu.Item
            leadingIcon="message-draw"
            onPress={() => navigateTo('AdminReviews')}
            title="Reviews"
          />
          <Menu.Item
            leadingIcon="file-chart"
            onPress={() => navigateTo('AdminReports')}
            title="Reports"
          />
        </>
      )}
      <Divider />
      <Menu.Item
        leadingIcon="logout"
        onPress={() => { setVisible(false); dispatch(logout()); }}
        title="Logout"
      />
    </Menu>
  );
}

const styles = StyleSheet.create({
  avatarBtn: { marginRight: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarIcon: { backgroundColor: '#e0e0e0' },
  menu: { marginTop: 4 },
  menuWeb: {
    minWidth: 220,
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(26, 26, 46, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
});
