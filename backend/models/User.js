const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, default: '', index: { unique: true, sparse: true } },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, default: '' },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    secondaryAddress: { type: String, default: '' },
    cartItems: [
      {
        productId: { type: String, required: true },
        name: { type: String, default: '' },
        price: { type: Number, default: 0 },
        quantity: { type: Number, default: 1, min: 1 },
        image: { type: String, default: '' },
        stock: { type: Number, default: 0 },
      },
    ],
    provider: { type: String, default: 'local' },
    providerId: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date, default: null },
    deactivationReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
