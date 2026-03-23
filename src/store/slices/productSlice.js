import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { API_URL } from '../../api/config';
import { auth } from '../../services/firebase';

export const fetchProducts = createAsyncThunk('products/fetchProducts', async (params = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/products', { params });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch products');
  }
});

export const fetchProduct = createAsyncThunk('products/fetchProduct', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/products/${id}`);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch product');
  }
});

export const createProduct = createAsyncThunk('products/createProduct', async (formData, { rejectWithValue }) => {
  try {
    // If caller passed a FormData (React Native file upload), use fetch() which handles multipart more reliably on RN
    if (typeof FormData !== 'undefined' && formData instanceof FormData) {
      const headers = {};
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.message || 'Failed to create product');
      return data;
    }

    const { data } = await api.post('/products', formData);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to create product');
  }
});

export const updateProduct = createAsyncThunk('products/updateProduct', async ({ id, formData }, { rejectWithValue }) => {
  try {
    if (typeof FormData !== 'undefined' && formData instanceof FormData) {
      const headers = {};
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'PUT',
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.message || 'Failed to update product');
      return data;
    }

    const { data } = await api.put(`/products/${id}`, formData);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update product');
  }
});

export const deleteProduct = createAsyncThunk('products/deleteProduct', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/products/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to delete product');
  }
});

export const fetchCategories = createAsyncThunk('products/fetchCategories', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/products/categories');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch categories');
  }
});

const productSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    currentProduct: null,
    categories: [],
    total: 0,
    page: 1,
    pages: 1,
    loading: false,
    error: null,
  },
  reducers: {
    clearProductError: (state) => { state.error = null; },
    clearCurrentProduct: (state) => { state.currentProduct = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.loading = true; })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.products;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
      })
      .addCase(fetchProducts.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchProduct.pending, (state) => { state.loading = true; })
      .addCase(fetchProduct.fulfilled, (state, action) => { state.loading = false; state.currentProduct = action.payload; })
      .addCase(fetchProduct.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createProduct.fulfilled, (state, action) => { state.items.unshift(action.payload); })
      .addCase(updateProduct.fulfilled, (state, action) => {
        const idx = state.items.findIndex(p => p._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
        if (state.currentProduct?._id === action.payload._id) state.currentProduct = action.payload;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p._id !== action.payload);
      })
      .addCase(fetchCategories.fulfilled, (state, action) => { state.categories = action.payload; });
  },
});

export const { clearProductError, clearCurrentProduct } = productSlice.actions;
export default productSlice.reducer;
