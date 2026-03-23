import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/config';

export const fetchAdminAnalytics = createAsyncThunk('admin/fetchAnalytics', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/admin/analytics');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch analytics');
  }
});

export const fetchAdminUsers = createAsyncThunk('admin/fetchUsers', async (params = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/admin/users', { params });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch users');
  }
});

export const updateAdminUser = createAsyncThunk('admin/updateUser', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/admin/users/${id}`, payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update user');
  }
});

export const deleteAdminUser = createAsyncThunk('admin/deleteUser', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/admin/users/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to delete user');
  }
});

export const fetchAdminInventory = createAsyncThunk('admin/fetchInventory', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/admin/inventory');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch inventory');
  }
});

export const updateAdminInventory = createAsyncThunk('admin/updateInventory', async ({ productId, payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/admin/products/${productId}/inventory`, payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update inventory');
  }
});

export const setAdminProductStatus = createAsyncThunk('admin/setProductStatus', async ({ productId, isActive, reason = '' }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/admin/products/${productId}/status`, { isActive, reason });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update product status');
  }
});

export const setAdminUserStatus = createAsyncThunk('admin/setUserStatus', async ({ id, isActive, reason = '' }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/admin/users/${id}/status`, { isActive, reason });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update user status');
  }
});

export const fetchAdminReviews = createAsyncThunk('admin/fetchReviews', async (params = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/admin/reviews', { params });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch reviews');
  }
});

export const deleteAdminReview = createAsyncThunk('admin/deleteReview', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/admin/reviews/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to delete review');
  }
});

export const fetchSalesReport = createAsyncThunk('admin/fetchSalesReport', async (range = '30d', { rejectWithValue }) => {
  try {
    const { data } = await api.get('/admin/reports/sales', { params: { range } });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch report');
  }
});

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    analytics: null,
    users: [],
    inventory: [],
    reviews: [],
    salesReport: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearAdminError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminAnalytics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.analytics = action.payload;
      })
      .addCase(fetchAdminAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchAdminUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchAdminUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateAdminUser.fulfilled, (state, action) => {
        const idx = state.users.findIndex((u) => u._id === action.payload._id);
        if (idx !== -1) state.users[idx] = action.payload;
      })
      .addCase(setAdminUserStatus.fulfilled, (state, action) => {
        const idx = state.users.findIndex((u) => u._id === action.payload._id);
        if (idx !== -1) state.users[idx] = action.payload;
      })
      .addCase(deleteAdminUser.fulfilled, (state, action) => {
        state.users = state.users.filter((u) => u._id !== action.payload);
      })
      .addCase(fetchAdminInventory.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAdminInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.inventory = action.payload;
      })
      .addCase(fetchAdminInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateAdminInventory.fulfilled, (state, action) => {
        const idx = state.inventory.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.inventory[idx] = action.payload;
      })
      .addCase(setAdminProductStatus.fulfilled, (state, action) => {
        const idx = state.inventory.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.inventory[idx] = action.payload;
      })
      .addCase(fetchAdminReviews.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAdminReviews.fulfilled, (state, action) => {
        state.loading = false;
        state.reviews = action.payload;
      })
      .addCase(fetchAdminReviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(deleteAdminReview.fulfilled, (state, action) => {
        state.reviews = state.reviews.filter((r) => r._id !== action.payload);
      })
      .addCase(fetchSalesReport.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSalesReport.fulfilled, (state, action) => {
        state.loading = false;
        state.salesReport = action.payload;
      })
      .addCase(fetchSalesReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearAdminError } = adminSlice.actions;
export default adminSlice.reducer;