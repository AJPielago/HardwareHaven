import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import productReducer from './slices/productSlice';
import orderReducer from './slices/orderSlice';
import reviewReducer from './slices/reviewSlice';
import cartReducer from './slices/cartSlice';
import notificationReducer from './slices/notificationSlice';
import adminReducer from './slices/adminSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    orders: orderReducer,
    reviews: reviewReducer,
    cart: cartReducer,
    notifications: notificationReducer,
    admin: adminReducer,
  },
});
