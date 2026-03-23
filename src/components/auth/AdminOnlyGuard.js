import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useSelector } from 'react-redux';

export default function AdminOnlyGuard({ navigation, children }) {
  const userRole = useSelector((state) => state.auth.user?.role);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (userRole === 'admin' || redirectedRef.current) return;

    redirectedRef.current = true;
    const routeNames = navigation.getState?.()?.routeNames || [];
    if (routeNames.includes('Products')) {
      navigation.replace('Products');
      return;
    }

    const parent = navigation.getParent?.();
    const parentRouteNames = parent?.getState?.()?.routeNames || [];

    if (parentRouteNames.includes('HomeStack')) {
      parent.navigate('HomeStack', { screen: 'Products' });
      return;
    }

    navigation.navigate('HomeStack', { screen: 'Products' });
  }, [navigation, userRole]);

  if (userRole === 'admin') {
    return children;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>Redirecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: {
    marginTop: 12,
    color: '#5D6C86',
  },
});
