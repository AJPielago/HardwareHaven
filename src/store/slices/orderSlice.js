import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/config';

export const createOrder = createAsyncThunk('orders/createOrder', async (orderData, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/orders', orderData);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to create order');
  }
});

export const fetchMyOrders = createAsyncThunk('orders/fetchMyOrders', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/orders/my-orders');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch orders');
  }
});

export const fetchOrder = createAsyncThunk('orders/fetchOrder', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/orders/${id}`);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch order');
  }
});

export const updateOrderStatus = createAsyncThunk('orders/updateOrderStatus', async ({ id, status, note }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/orders/${id}/status`, { status, note });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update order status');
  }
});

export const fetchAllOrders = createAsyncThunk('orders/fetchAllOrders', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/orders');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch orders');
  }
});

const orderSlice = createSlice({
  name: 'orders',
  initialState: {
    items: [],
    allOrders: [],
    currentOrder: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearOrderError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.pending, (state) => { state.loading = true; })
      .addCase(createOrder.fulfilled, (state, action) => { state.loading = false; state.items.unshift(action.payload); })
      .addCase(createOrder.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchMyOrders.pending, (state) => { state.loading = true; })
      .addCase(fetchMyOrders.fulfilled, (state, action) => { state.loading = false; state.items = action.payload; })
      .addCase(fetchMyOrders.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchOrder.fulfilled, (state, action) => { state.currentOrder = action.payload; })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const idx = state.allOrders.findIndex(o => o._id === action.payload._id);
        if (idx !== -1) state.allOrders[idx] = action.payload;
        const idx2 = state.items.findIndex(o => o._id === action.payload._id);
        if (idx2 !== -1) state.items[idx2] = action.payload;
        if (state.currentOrder?._id === action.payload._id) state.currentOrder = action.payload;
      })
      .addCase(fetchAllOrders.pending, (state) => { state.loading = true; })
      .addCase(fetchAllOrders.fulfilled, (state, action) => { state.loading = false; state.allOrders = action.payload; })
      .addCase(fetchAllOrders.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { clearOrderError } = orderSlice.actions;
export default orderSlice.reducer;
