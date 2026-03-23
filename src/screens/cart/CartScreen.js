import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import { Card, Text, Button, IconButton, Divider, Title, Portal, Dialog } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { loadCart, updateCartQuantity, removeFromCart, clearCart } from '../../store/slices/cartSlice';
import { getImageUrl } from '../../api/config';
import { useResponsive } from '../../utils/responsive';

export default function CartScreen({ navigation }) {
  const dispatch = useDispatch();
  const { items } = useSelector((state) => state.cart);
  const { isWeb, isDesktop } = useResponsive();
  const [showClearCartDialog, setShowClearCartDialog] = useState(false);

  const confirmAction = useCallback((title, message, onConfirm) => {
    if (Platform.OS === 'web') {
      const confirmFn = typeof globalThis?.confirm === 'function' ? globalThis.confirm : null;
      if (!confirmFn || confirmFn(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }, []);

  const navigateToProducts = useCallback(() => {
    const routeNames = navigation.getState?.()?.routeNames || [];
    if (routeNames.includes('Products')) {
      navigation.navigate('Products');
      return;
    }

    if (routeNames.includes('HomeStack')) {
      navigation.navigate('HomeStack', { screen: 'Products' });
      return;
    }

    const parent = navigation.getParent?.();
    const parentRouteNames = parent?.getState?.()?.routeNames || [];

    if (parentRouteNames.includes('Products')) {
      parent.navigate('Products');
      return;
    }

    if (parentRouteNames.includes('HomeStack')) {
      parent.navigate('HomeStack', { screen: 'Products' });
      return;
    }

    navigation.navigate('HomeStack', { screen: 'Products' });
  }, [navigation]);

  useEffect(() => {
    dispatch(loadCart());
  }, []);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleRemove = (productId) => {
    confirmAction('Remove Item', 'Remove this item from cart?', () => {
      dispatch(removeFromCart(productId));
    });
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart first');
      return;
    }
    const routeNames = navigation.getState?.()?.routeNames || [];

    if (routeNames.includes('Checkout')) {
      navigation.navigate('Checkout');
      return;
    }

    navigation.navigate('HomeStack', { screen: 'Checkout' });
  };

  const handleClearCartPress = () => {
    if (isWeb) {
      setShowClearCartDialog(true);
      return;
    }

    confirmAction('Clear Cart', 'Remove all items?', () => {
      dispatch(clearCart());
    });
  };

  const renderItem = ({ item }) => (
    <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
      <Card.Content style={[styles.cardContent, isDesktop && styles.cardContentDesktop]}>
        <View style={[styles.itemInfo, isDesktop && styles.itemInfoDesktop]}>
          {item.image ? (
            <Card.Cover source={{ uri: getImageUrl(item.image) }} style={[styles.itemImage, isDesktop && styles.itemImageDesktop]} />
          ) : (
            <View style={[styles.imagePlaceholder, isDesktop && styles.itemImageDesktop]}><Text style={{ fontSize: 10 }}>No Img</Text></View>
          )}
          <View style={styles.itemDetails}>
            <Text variant="titleMedium" numberOfLines={2} style={styles.itemName}>{item.name}</Text>
            <Text style={styles.price}>₱{item.price.toFixed(2)}</Text>
            {isDesktop && (
              <Text style={styles.stockInfo}>In Stock</Text>
            )}
          </View>
          <View style={[styles.quantityRow, isDesktop && styles.quantityRowDesktop]}>
            <View style={styles.quantityControls}>
              <IconButton
                icon="minus"
                size={isDesktop ? 24 : 20}
                mode="outlined"
                onPress={() => dispatch(updateCartQuantity({ productId: item.productId, quantity: item.quantity - 1 }))}
                style={styles.qtyButton}
              />
              <Text style={[styles.quantity, isDesktop && styles.quantityDesktop]}>{item.quantity}</Text>
              <IconButton
                icon="plus"
                size={isDesktop ? 24 : 20}
                mode="outlined"
                onPress={() => dispatch(updateCartQuantity({ productId: item.productId, quantity: item.quantity + 1 }))}
                style={styles.qtyButton}
              />
            </View>
            <Text style={[styles.subtotal, isDesktop && styles.subtotalDesktop]}>₱{(item.price * item.quantity).toFixed(2)}</Text>
            <IconButton icon="delete" size={isDesktop ? 24 : 20} onPress={() => handleRemove(item.productId)} iconColor="#ef4444" />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {isDesktop && items.length > 0 && (
        <View style={styles.headerDesktop}>
          <Text variant="headlineMedium" style={styles.headerTitle}>Shopping Cart</Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>{items.length} item{items.length !== 1 ? 's' : ''} in your cart</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.productId || item.id?.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconButton icon="cart-off" size={64} iconColor="#ccc" />
            <Text variant="headlineSmall" style={styles.emptyTitle}>Your cart is empty</Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>Add some products to get started</Text>
            <Button mode="contained" onPress={navigateToProducts} style={styles.shopBtn} buttonColor="#7c3aed">
              Browse Products
            </Button>
          </View>
        }
        contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
      />

      {items.length > 0 && (
        <View style={[styles.footer, isDesktop && styles.footerDesktop]}>
          <Divider />
          <View style={styles.totalRow}>
            <Text variant="titleLarge" style={styles.totalLabel}>Total:</Text>
            <Text variant="headlineMedium" style={styles.totalPrice}>₱{total.toFixed(2)}</Text>
          </View>
          <Button mode="contained" onPress={handleCheckout} style={styles.checkoutBtn} buttonColor="#7c3aed" contentStyle={isDesktop && styles.checkoutBtnContent}>
            Proceed to Checkout
          </Button>
          <TouchableOpacity
            onPress={handleClearCartPress}
            style={styles.clearBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.clearBtnLabel}>Clear Cart</Text>
          </TouchableOpacity>
        </View>
      )}

      {isWeb && (
        <Portal>
          <Dialog
            visible={showClearCartDialog}
            onDismiss={() => setShowClearCartDialog(false)}
            style={styles.webConfirmDialog}
          >
            <Dialog.Title>Clear Cart</Dialog.Title>
            <Dialog.Content>
              <Text>Remove all items?</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowClearCartDialog(false)}>Cancel</Button>
              <Button
                textColor="#ef4444"
                onPress={() => {
                  setShowClearCartDialog(false);
                  dispatch(clearCart());
                }}
              >
                Clear
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  containerDesktop: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 40,
  },
  headerDesktop: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontWeight: '700', color: '#1a1a2e' },
  headerSubtitle: { color: '#666', marginTop: 4 },
  list: { padding: 10, flexGrow: 1 },
  listDesktop: {
    padding: 0,
    paddingTop: 16,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  card: { marginBottom: 10, borderRadius: 12, overflow: 'hidden' },
  cardDesktop: {
    marginBottom: 16,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      default: { elevation: 2 },
    }),
  },
  cardContent: { paddingVertical: 12 },
  cardContentDesktop: { padding: 20 },
  itemInfo: { marginBottom: 10 },
  itemInfoDesktop: { marginBottom: 0, flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 60, height: 60, borderRadius: 8 },
  itemImageDesktop: { width: 100, height: 100, borderRadius: 12 },
  imagePlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  itemDetails: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  itemName: { fontWeight: '600', color: '#1a1a2e' },
  price: { color: '#7c3aed', fontWeight: '700', marginTop: 4, fontSize: 16 },
  stockInfo: { color: '#22c55e', fontSize: 12, marginTop: 4 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  quantityRowDesktop: { marginTop: 0, marginLeft: 'auto', alignItems: 'center' },
  quantityControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 4 },
  qtyButton: { margin: 0 },
  quantity: { fontSize: 16, fontWeight: '700', marginHorizontal: 12, minWidth: 24, textAlign: 'center' },
  quantityDesktop: { fontSize: 18 },
  subtotal: { flex: 1, textAlign: 'right', fontWeight: '700', marginRight: 8, fontSize: 14 },
  subtotalDesktop: { fontSize: 18, color: '#1a1a2e', minWidth: 100 },
  footer: { padding: 15, backgroundColor: '#fff', ...Platform.select({ web: { boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' }, default: { elevation: 5 } }) },
  footerDesktop: {
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  totalLabel: { fontWeight: '600', color: '#666' },
  totalPrice: { color: '#7c3aed', fontWeight: '700' },
  checkoutBtn: { marginTop: 8, paddingVertical: 6, borderRadius: 12 },
  checkoutBtnContent: { paddingVertical: 8, paddingHorizontal: 32 },
  clearBtn: {
    marginTop: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnLabel: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#666', marginTop: 16 },
  emptySubtitle: { color: '#999', marginTop: 8 },
  shopBtn: { marginTop: 24, borderRadius: 12 },
  empty: { textAlign: 'center', marginTop: 100, color: '#999', fontSize: 16 },
  webConfirmDialog: {
    width: '92%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 16,
  },
});
