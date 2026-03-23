const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    name: { type: String, default: '' },
    price: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    shippingAddress: { type: String, required: true },
    paymentMethod: { type: String, default: 'cod' },
    items: [orderItemSchema],
    statusHistory: [statusHistorySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
