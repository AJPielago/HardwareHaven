import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/config';

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/notifications');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch notifications');
  }
});

export const markNotificationRead = createAsyncThunk('notifications/markRead', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/notifications/${id}/read`);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to mark notification as read');
  }
});

export const sendPromotion = createAsyncThunk('notifications/sendPromotion', async (promoData, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/notifications/promotion', promoData);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to send promotion');
  }
});

export const fetchNotificationDetail = createAsyncThunk('notifications/fetchDetail', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/notifications/${id}`);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch notification');
  }
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    currentNotification: null,
    loading: false,
    error: null,
    unreadCount: 0,
  },
  reducers: {
    addNotification: (state, action) => {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.unreadCount = action.payload.filter(n => !n.isRead).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const idx = state.items.findIndex(n => n._id === action.payload._id);
        if (idx !== -1) { state.items[idx] = action.payload; }
        state.unreadCount = state.items.filter(n => !n.isRead).length;
      })
      .addCase(fetchNotificationDetail.fulfilled, (state, action) => { state.currentNotification = action.payload; });
  },
});

export const { addNotification } = notificationSlice.actions;
export default notificationSlice.reducer;
