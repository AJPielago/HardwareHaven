import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import ProductListScreen from '../screens/products/ProductListScreen';
import LandingScreen from '../screens/auth/LandingScreen';
import ProductDetailScreen from '../screens/products/ProductDetailScreen';
import ProductFormScreen from '../screens/products/ProductFormScreen';
import CartScreen from '../screens/cart/CartScreen';
import CheckoutScreen from '../screens/cart/CheckoutScreen';
import ReviewFormScreen from '../screens/reviews/ReviewFormScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import ProfileMenu from './ProfileMenu';
import { brand } from '../theme/brandTheme';
import AdminOnlyGuard from '../components/auth/AdminOnlyGuard';

const Stack = createStackNavigator();

export default function HomeNavigator() {
  const userRole = useSelector((state) => state.auth.user?.role);

  return (
    <Stack.Navigator
      screenOptions={{
        headerRight: () => <ProfileMenu />,
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: brand.colors.navy,
        headerTitleStyle: {
          color: brand.colors.navy,
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen name="Products" component={ProductListScreen} options={{ title: '' }} />
      <Stack.Screen name="LandingHome" component={LandingScreen} options={{ title: 'Welcome' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product Details' }} />
      <Stack.Screen name="ProductForm" options={({ route }) => ({ title: route.params?.product ? 'Edit Product' : 'Add Product' })}>
        {(props) => (
          <AdminOnlyGuard navigation={props.navigation}>
            <ProductFormScreen {...props} userRole={userRole} />
          </AdminOnlyGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
      <Stack.Screen name="ReviewForm" component={ReviewFormScreen} options={{ title: 'Write Review' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order Details' }} />
    </Stack.Navigator>
  );
}
