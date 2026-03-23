import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/config';

export const fetchProductReviews = createAsyncThunk('reviews/fetchProductReviews', async (productId, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/reviews/product/${productId}`);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch reviews');
  }
});

export const createReview = createAsyncThunk('reviews/createReview', async (reviewData, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/reviews', reviewData);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to create review');
  }
});

export const updateReview = createAsyncThunk('reviews/updateReview', async ({ id, rating, comment }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/reviews/${id}`, { rating, comment });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update review');
  }
});

export const deleteReview = createAsyncThunk('reviews/deleteReview', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/reviews/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to delete review');
  }
});

const reviewSlice = createSlice({
  name: 'reviews',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearReviewError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductReviews.pending, (state) => { state.loading = true; })
      .addCase(fetchProductReviews.fulfilled, (state, action) => { state.loading = false; state.items = action.payload; })
      .addCase(fetchProductReviews.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createReview.fulfilled, (state, action) => { state.items.unshift(action.payload); })
      .addCase(updateReview.fulfilled, (state, action) => {
        const idx = state.items.findIndex(r => r._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteReview.fulfilled, (state, action) => {
        state.items = state.items.filter(r => r._id !== action.payload);
      });
  },
});

export const { clearReviewError } = reviewSlice.actions;
export default reviewSlice.reducer;
