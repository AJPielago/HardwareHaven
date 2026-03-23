const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: String, required: true, trim: true },
    orderId: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
