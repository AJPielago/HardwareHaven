import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Button, Text, Title, Divider, RadioButton, Snackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { createOrder } from '../../store/slices/orderSlice';
import { clearCart } from '../../store/slices/cartSlice';
import { useResponsive } from '../../utils/responsive';

export default function CheckoutScreen({ navigation }) {
  const dispatch = useDispatch();
  const { items } = useSelector((state) => state.cart);
  const { user } = useSelector((state) => state.auth);
  const { loading } = useSelector((state) => state.orders);

  const addressOptions = useMemo(() => {
    const options = [];
    const primaryAddress = String(user?.address || '').trim();
    const secondaryAddress = String(user?.secondaryAddress || '').trim();

    if (primaryAddress) {
      options.push({ key: 'primary', label: 'Primary Address', value: primaryAddress });
    }

    if (secondaryAddress && secondaryAddress !== primaryAddress) {
      options.push({ key: 'secondary', label: 'Secondary Address', value: secondaryAddress });
    }

    return options;
  }, [user?.address, user?.secondaryAddress]);

  const [shippingAddress, setShippingAddress] = useState(addressOptions[0]?.value || '');
  const paymentMethod = 'cod';
  const { isDesktop } = useResponsive();
  const [snack, setSnack] = useState({ visible: false, message: '', error: false });

  const showSnack = (message, error = false) => {
    setSnack({ visible: true, message, error });
  };

  useEffect(() => {
    setShippingAddress(addressOptions[0]?.value || '');
  }, [addressOptions]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!shippingAddress.trim()) {
      if (Platform.OS === 'web') {
        showSnack('Please choose a shipping address or add one in Profile.', true);
      } else {
        Alert.alert('Error', 'Please enter a shipping address');
      }
      return;
    }

    try {
      const orderItems = items.map((item) => ({
        product: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      }));

      await dispatch(createOrder({
        items: orderItems,
        totalAmount: total,
        shippingAddress,
        paymentMethod,
      })).unwrap();

      // Clear cart after successful order (SQLite)
      await dispatch(clearCart()).unwrap();

      if (Platform.OS === 'web') {
        showSnack('Order placed successfully.', false);
      } else {
        Alert.alert('Order Placed!', 'Your order has been placed successfully!', [
          { text: 'View Orders', onPress: () => navigation.navigate('Orders') },
          { text: 'Continue Shopping', onPress: () => navigation.navigate('Products') },
        ]);
      }
    } catch (err) {
      if (Platform.OS === 'web') {
        showSnack(String(err || 'Failed to place order'), true);
      } else {
        Alert.alert('Error', err || 'Failed to place order');
      }
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <Title style={styles.title}>Checkout</Title>

      <Text variant="titleMedium" style={styles.sectionTitle}>Order Summary</Text>
      {items.map((item) => (
        <View key={item.productId} style={styles.itemRow}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text>x{item.quantity}</Text>
          <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
        </View>
      ))}
      <Divider style={{ marginVertical: 10 }} />
      <View style={styles.totalRow}>
        <Text variant="titleMedium">Total:</Text>
        <Text variant="titleMedium" style={styles.total}>₱{total.toFixed(2)}</Text>
      </View>

      <Divider style={{ marginVertical: 15 }} />

      <Text variant="titleMedium" style={styles.sectionTitle}>Shipping Address</Text>
      {addressOptions.length > 0 ? (
        <RadioButton.Group onValueChange={setShippingAddress} value={shippingAddress}>
          {addressOptions.map((option) => (
            <View key={option.key} style={styles.addressOption}>
              <View style={styles.addressOptionHeader}>
                <RadioButton value={option.value} />
                <Text style={styles.addressOptionTitle}>{option.label}</Text>
              </View>
              <Text style={styles.addressOptionText}>{option.value}</Text>
            </View>
          ))}
        </RadioButton.Group>
      ) : (
        <Text style={styles.addressMissing}>
          No shipping address found. Add one in Profile before placing an order.
        </Text>
      )}

      <Text variant="titleMedium" style={styles.sectionTitle}>Payment Method</Text>
      <View style={styles.paymentOptions}>
        <Button mode="contained" disabled style={styles.paymentBtn}>
          Cash on Delivery
        </Button>
      </View>

      <Button
        mode="contained"
        onPress={handlePlaceOrder}
        loading={loading}
        disabled={loading || items.length === 0 || !shippingAddress.trim()}
        style={styles.placeOrderBtn}
        buttonColor="#7c3aed"
      >
        Place Order (₱{total.toFixed(2)})
      </Button>

      {Platform.OS === 'web' && (
        <View style={styles.webPostOrderRow}>
          <Button mode="text" onPress={() => navigation.navigate('Orders')} textColor="#7c3aed">
            View orders
          </Button>
          <Button mode="text" onPress={() => navigation.navigate('Products')} textColor="#7c3aed">
            Continue shopping
          </Button>
        </View>
      )}

      </ScrollView>
      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
        duration={snack.error ? 5000 : 4000}
        style={snack.error ? styles.snackError : styles.snackOk}
        action={
          !snack.error
            ? { label: 'Orders', onPress: () => navigation.navigate('Orders') }
            : undefined
        }
      >
        {snack.message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  container: { flexGrow: 1, padding: 20 },
  containerDesktop: {
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 32,
  },
  webPostOrderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  snackOk: { backgroundColor: '#1a1a2e' },
  snackError: { backgroundColor: '#b00020' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  sectionTitle: { marginBottom: 10, fontWeight: 'bold' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  itemName: { flex: 1, marginRight: 10 },
  itemPrice: { fontWeight: 'bold', minWidth: 70, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: '#e91e63', fontWeight: 'bold' },
  addressOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  addressOptionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  addressOptionTitle: { fontWeight: '600' },
  addressOptionText: { color: '#444', lineHeight: 20, paddingLeft: 8 },
  addressMissing: { color: '#b00020', marginBottom: 15 },
  paymentOptions: { marginBottom: 15 },
  paymentBtn: { width: '100%' },
  placeOrderBtn: { marginTop: 10, paddingVertical: 8 },
});
