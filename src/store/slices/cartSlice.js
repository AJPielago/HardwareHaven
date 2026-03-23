import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { openDatabaseAsync } from '../../utils/sqliteWeb';
import api from '../../api/config';
import { auth } from '../../services/firebase';

let db = null;

const hasAuthenticatedUser = () => Boolean(auth?.currentUser);

const getDb = async () => {
  if (!db) {
    db = await openDatabaseAsync('shopapp.db');
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        image TEXT,
        stock INTEGER DEFAULT 0
      );`
    );
  }
  return db;
};

export const loadCart = createAsyncThunk('cart/loadCart', async () => {
  if (hasAuthenticatedUser()) {
    const { data } = await api.get('/cart');
    return data;
  }

  const database = await getDb();
  return await database.getAllAsync('SELECT * FROM cart');
});

export const addToCart = createAsyncThunk('cart/addToCart', async (item, { dispatch }) => {
  if (hasAuthenticatedUser()) {
    await api.post('/cart', item);
    dispatch(loadCart());
    return;
  }

  const database = await getDb();
  const existing = await database.getFirstAsync('SELECT * FROM cart WHERE productId = ?', [item.productId]);
  if (existing) {
    await database.runAsync('UPDATE cart SET quantity = quantity + 1 WHERE productId = ?', [item.productId]);
  } else {
    await database.runAsync(
      'INSERT INTO cart (productId, name, price, quantity, image, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [item.productId, item.name, item.price, 1, item.image || '', item.stock || 0]
    );
  }
  dispatch(loadCart());
});

export const updateCartQuantity = createAsyncThunk('cart/updateCartQuantity', async ({ productId, quantity }, { dispatch }) => {
  if (hasAuthenticatedUser()) {
    await api.put(`/cart/${productId}`, { quantity });
    dispatch(loadCart());
    return;
  }

  const database = await getDb();
  if (quantity <= 0) {
    await database.runAsync('DELETE FROM cart WHERE productId = ?', [productId]);
  } else {
    await database.runAsync('UPDATE cart SET quantity = ? WHERE productId = ?', [quantity, productId]);
  }
  dispatch(loadCart());
});

export const removeFromCart = createAsyncThunk('cart/removeFromCart', async (productId, { dispatch }) => {
  if (hasAuthenticatedUser()) {
    await api.delete(`/cart/${productId}`);
    dispatch(loadCart());
    return;
  }

  const database = await getDb();
  await database.runAsync('DELETE FROM cart WHERE productId = ?', [productId]);
  dispatch(loadCart());
});

export const clearCart = createAsyncThunk('cart/clearCart', async () => {
  if (hasAuthenticatedUser()) {
    await api.delete('/cart');
    return [];
  }

  const database = await getDb();
  await database.runAsync('DELETE FROM cart');
  return [];
});

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    loading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCart.pending, (state) => { state.loading = true; })
      .addCase(loadCart.fulfilled, (state, action) => { state.loading = false; state.items = action.payload; })
      .addCase(clearCart.fulfilled, (state) => { state.items = []; });
  },
});

export default cartSlice.reducer;
